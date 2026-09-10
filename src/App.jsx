import { useState, useCallback, useEffect, useRef } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { nanoid } from 'nanoid';
import NodoPersonalizado from './NodoPersonalizado';
import { supabase } from './supabaseClient';
import './styles.css';

const nodeTypes = { nodoPersonalizado: NodoPersonalizado };

// Toma el id del mapa desde la URL: ?mapa=xxxx
// Si no hay ninguno, genera uno nuevo y lo pone en la URL para que puedas compartir el enlace.
function obtenerMapaId() {
  const params = new URLSearchParams(window.location.search);
  let mapaId = params.get('mapa');
  if (!mapaId) {
    mapaId = nanoid(10);
    params.set('mapa', mapaId);
    window.history.replaceState({}, '', `${window.location.pathname}?${params}`);
  }
  return mapaId;
}

export default function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const mapaId = useRef(obtenerMapaId());

  // --- Guardar un nodo en Supabase (crear o actualizar) ---
  const guardarNodoEnDB = useCallback(async (nodo, padreId) => {
    setGuardando(true);
    await supabase.from('nodos').upsert({
      id: nodo.id,
      mapa_id: mapaId.current,
      texto: nodo.data.texto,
      hipervinculo: nodo.data.hipervinculo || null,
      padre_id: padreId || null,
      posicion_x: nodo.position.x,
      posicion_y: nodo.position.y,
    });
    setGuardando(false);
  }, []);

  const eliminarNodoEnDB = useCallback(async (id) => {
    setGuardando(true);
    await supabase.from('nodos').delete().eq('id', id);
    setGuardando(false);
  }, []);

  // --- Acciones sobre nodos (definidas antes de cargar, para inyectarlas en data) ---
  const cambiarTexto = useCallback(
    (id, nuevoTexto) => {
      setNodes((nds) => {
        const actualizados = nds.map((n) =>
          n.id === id ? { ...n, data: { ...n.data, texto: nuevoTexto } } : n
        );
        const nodo = actualizados.find((n) => n.id === id);
        const edge = edges.find((e) => e.target === id);
        guardarNodoEnDB(nodo, edge ? edge.source : null);
        return actualizados;
      });
    },
    [edges, guardarNodoEnDB, setNodes]
  );

  const cambiarLink = useCallback(
    (id, nuevoLink) => {
      setNodes((nds) => {
        const actualizados = nds.map((n) =>
          n.id === id ? { ...n, data: { ...n.data, hipervinculo: nuevoLink } } : n
        );
        const nodo = actualizados.find((n) => n.id === id);
        const edge = edges.find((e) => e.target === id);
        guardarNodoEnDB(nodo, edge ? edge.source : null);
        return actualizados;
      });
    },
    [edges, guardarNodoEnDB, setNodes]
  );

  const eliminarNodo = useCallback(
    (id) => {
      // Elimina el nodo y todos sus descendientes (en cascada, igual que en la BD)
      setNodes((nds) => {
        const idsAEliminar = new Set([id]);
        let cambiado = true;
        while (cambiado) {
          cambiado = false;
          edges.forEach((e) => {
            if (idsAEliminar.has(e.source) && !idsAEliminar.has(e.target)) {
              idsAEliminar.add(e.target);
              cambiado = true;
            }
          });
        }
        idsAEliminar.forEach((idBorrar) => eliminarNodoEnDB(idBorrar));
        return nds.filter((n) => !idsAEliminar.has(n.id));
      });
      setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
    },
    [edges, eliminarNodoEnDB, setEdges, setNodes]
  );

  const crearNodo = useCallback(
    (texto, posicion, esRaiz = false) => ({
      id: nanoid(8),
      type: 'nodoPersonalizado',
      position: posicion,
      data: {
        texto,
        hipervinculo: '',
        esRaiz,
        onCambiarTexto: cambiarTexto,
        onCambiarLink: cambiarLink,
        onEliminar: eliminarNodo,
        onAgregarHijo: null, // se asigna abajo tras definir agregarHijo
      },
    }),
    [cambiarTexto, cambiarLink, eliminarNodo]
  );

  const agregarHijo = useCallback(
    (padreId) => {
      setNodes((nds) => {
        const padre = nds.find((n) => n.id === padreId);
        if (!padre) return nds;

        const hijosDelPadre = edges.filter((e) => e.source === padreId).length;
        const nuevaPos = {
          x: padre.position.x + 260,
          y: padre.position.y + hijosDelPadre * 90,
        };

        const nuevoNodo = crearNodo('Nuevo nodo', nuevaPos);
        nuevoNodo.data.onAgregarHijo = agregarHijoRef.current;

        setEdges((eds) =>
          addEdge(
            { id: `e-${padreId}-${nuevoNodo.id}`, source: padreId, target: nuevoNodo.id },
            eds
          )
        );

        guardarNodoEnDB(nuevoNodo, padreId);

        return [...nds, nuevoNodo];
      });
    },
    [edges, crearNodo, guardarNodoEnDB, setEdges, setNodes]
  );

  // Ref para poder auto-referenciar agregarHijo dentro de crearNodo (evita dependencia circular)
  const agregarHijoRef = useRef();
  useEffect(() => {
    agregarHijoRef.current = agregarHijo;
  }, [agregarHijo]);

  // --- Cargar el mapa desde Supabase al iniciar ---
  useEffect(() => {
    async function cargarMapa() {
      setCargando(true);
      const { data, error } = await supabase
        .from('nodos')
        .select('*')
        .eq('mapa_id', mapaId.current);

      if (error) {
        console.error('Error cargando el mapa:', error);
        setCargando(false);
        return;
      }

      if (!data || data.length === 0) {
        // Mapa nuevo: crea el nodo raíz
        const raiz = crearNodo('Tema central', { x: 50, y: 200 }, true);
        raiz.data.onAgregarHijo = agregarHijoRef.current;
        setNodes([raiz]);
        guardarNodoEnDB(raiz, null);
      } else {
        const nodosCargados = data.map((fila) =>
          Object.assign(crearNodo(fila.texto, { x: fila.posicion_x, y: fila.posicion_y }, !fila.padre_id), {
            id: fila.id,
            data: {
              texto: fila.texto,
              hipervinculo: fila.hipervinculo || '',
              esRaiz: !fila.padre_id,
              onCambiarTexto: cambiarTexto,
              onCambiarLink: cambiarLink,
              onEliminar: eliminarNodo,
              onAgregarHijo: (id) => agregarHijoRef.current(id),
            },
          })
        );
        const edgesCargados = data
          .filter((fila) => fila.padre_id)
          .map((fila) => ({
            id: `e-${fila.padre_id}-${fila.id}`,
            source: fila.padre_id,
            target: fila.id,
          }));

        setNodes(nodosCargados);
        setEdges(edgesCargados);
      }
      setCargando(false);
    }

    cargarMapa();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onNodeDragStop = useCallback(
    (_, nodo) => {
      const edge = edges.find((e) => e.target === nodo.id);
      guardarNodoEnDB(nodo, edge ? edge.source : null);
    },
    [edges, guardarNodoEnDB]
  );

  const copiarEnlaceCompartible = () => {
    navigator.clipboard.writeText(window.location.href);
    alert('¡Enlace copiado! Compártelo para que otros vean o editen este mapa.');
  };

  if (cargando) {
    return <div className="pantalla-carga">Cargando tu mapa mental…</div>;
  }

  return (
    <div className="app-contenedor">
      <header className="app-header">
        <h1>Mapa Mental</h1>
        <div className="app-header-info">
          <span className="contador-nodos">{nodes.length} nodos · sin límite</span>
          <span className="estado-guardado">{guardando ? 'Guardando…' : 'Guardado ✓'}</span>
          <button className="boton-compartir" onClick={copiarEnlaceCompartible}>
            Compartir mapa
          </button>
        </div>
      </header>

      <div className="app-lienzo">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeDragStop={onNodeDragStop}
          nodeTypes={nodeTypes}
          fitView
        >
          <Background gap={20} />
          <Controls />
          <MiniMap pannable zoomable />
        </ReactFlow>
      </div>
    </div>
  );
}
