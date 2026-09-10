import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import ReactFlow, {
  Controls,
  MiniMap,
  addEdge,
  applyNodeChanges,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { nanoid } from 'nanoid';
import NodoPersonalizado from './NodoPersonalizado';
import { supabase } from './supabaseClient';
import './styles.css';

const nodeTypes = { nodoPersonalizado: NodoPersonalizado };

const PALETA_RAMAS = ['#e0559a', '#f5a442', '#e0c93f', '#2fa88f', '#8e6fd1', '#4a90e2', '#e0554f'];
const COLOR_RAIZ = '#334155';

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
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [colapsados, setColapsados] = useState(new Set());
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const mapaId = useRef(obtenerMapaId());

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
      color: nodo.data.color || null,
      imagen_url: nodo.data.imagenUrl || null,
    });
    setGuardando(false);
  }, []);

  const eliminarNodoEnDB = useCallback(async (id) => {
    setGuardando(true);
    await supabase.from('nodos').delete().eq('id', id);
    setGuardando(false);
  }, []);

  const cambiarTexto = useCallback(
    (id, nuevoTexto) => {
      setNodes((nds) => {
        const actualizados = nds.map((n) =>
          n.id === id ? { ...n, data: { ...n.data, texto: nuevoTexto } } : n
        );
        const nodo = actualizados.find((n) => n.id === id);
        setEdges((eds) => {
          const edge = eds.find((e) => e.target === id);
          guardarNodoEnDB(nodo, edge ? edge.source : null);
          return eds;
        });
        return actualizados;
      });
    },
    [guardarNodoEnDB]
  );

  const cambiarLink = useCallback(
    (id, nuevoLink) => {
      setNodes((nds) => {
        const actualizados = nds.map((n) =>
          n.id === id ? { ...n, data: { ...n.data, hipervinculo: nuevoLink } } : n
        );
        const nodo = actualizados.find((n) => n.id === id);
        setEdges((eds) => {
          const edge = eds.find((e) => e.target === id);
          guardarNodoEnDB(nodo, edge ? edge.source : null);
          return eds;
        });
        return actualizados;
      });
    },
    [guardarNodoEnDB]
  );

  const cambiarImagen = useCallback(
    (id, nuevaImagenUrl) => {
      setNodes((nds) => {
        const actualizados = nds.map((n) =>
          n.id === id ? { ...n, data: { ...n.data, imagenUrl: nuevaImagenUrl } } : n
        );
        const nodo = actualizados.find((n) => n.id === id);
        setEdges((eds) => {
          const edge = eds.find((e) => e.target === id);
          guardarNodoEnDB(nodo, edge ? edge.source : null);
          return eds;
        });
        return actualizados;
      });
    },
    [guardarNodoEnDB]
  );

  const eliminarNodo = useCallback(
    (id) => {
      setNodes((nds) => {
        let idsAEliminar = new Set([id]);
        setEdges((eds) => {
          let cambiado = true;
          while (cambiado) {
            cambiado = false;
            eds.forEach((e) => {
              if (idsAEliminar.has(e.source) && !idsAEliminar.has(e.target)) {
                idsAEliminar.add(e.target);
                cambiado = true;
              }
            });
          }
          idsAEliminar.forEach((idBorrar) => eliminarNodoEnDB(idBorrar));
          return eds.filter((e) => !idsAEliminar.has(e.source) && !idsAEliminar.has(e.target));
        });
        return nds.filter((n) => !idsAEliminar.has(n.id));
      });
    },
    [eliminarNodoEnDB]
  );

  const toggleColapso = useCallback((id) => {
    setColapsados((prev) => {
      const siguiente = new Set(prev);
      if (siguiente.has(id)) siguiente.delete(id);
      else siguiente.add(id);
      return siguiente;
    });
  }, []);

  const crearNodo = useCallback(
    (texto, posicion, esRaiz = false, color = COLOR_RAIZ) => ({
      id: nanoid(8),
      type: 'nodoPersonalizado',
      position: posicion,
      data: {
        texto,
        hipervinculo: '',
        imagenUrl: null,
        esRaiz,
        color,
        onCambiarTexto: cambiarTexto,
        onCambiarLink: cambiarLink,
        onCambiarImagen: cambiarImagen,
        onEliminar: eliminarNodo,
        onAgregarHijo: null,
      },
    }),
    [cambiarTexto, cambiarLink, cambiarImagen, eliminarNodo]
  );

  const agregarHijoRef = useRef();

  const agregarHijo = useCallback(
    (padreId) => {
      setNodes((nds) => {
        const padre = nds.find((n) => n.id === padreId);
        if (!padre) return nds;

        let colorAsignado = padre.data.color;
        let nuevaPos = { x: padre.position.x + 260, y: padre.position.y };

        setEdges((eds) => {
          const hijosDelPadre = eds.filter((e) => e.source === padreId).length;
          nuevaPos = { x: padre.position.x + 260, y: padre.position.y + hijosDelPadre * 90 };
          colorAsignado = padre.data.esRaiz
            ? PALETA_RAMAS[hijosDelPadre % PALETA_RAMAS.length]
            : padre.data.color;

          const nuevoNodo = crearNodo('Nuevo nodo', nuevaPos, false, colorAsignado);
          nuevoNodo.data.onAgregarHijo = agregarHijoRef.current;
          guardarNodoEnDB(nuevoNodo, padreId);

          setNodes((nds2) => [...nds2, nuevoNodo]);

          return [
            ...eds,
            {
              id: `e-${padreId}-${nuevoNodo.id}`,
              source: padreId,
              target: nuevoNodo.id,
              type: 'smoothstep',
              style: { stroke: colorAsignado, strokeWidth: 2 },
            },
          ];
        });

        return nds;
      });
    },
    [crearNodo, guardarNodoEnDB]
  );

  useEffect(() => {
    agregarHijoRef.current = agregarHijo;
  }, [agregarHijo]);

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
        const raiz = crearNodo('Tema central', { x: 50, y: 200 }, true, COLOR_RAIZ);
        raiz.data.onAgregarHijo = (id) => agregarHijoRef.current(id);
        setNodes([raiz]);
        guardarNodoEnDB(raiz, null);
      } else {
        const nodosCargados = data.map((fila) => ({
          id: fila.id,
          type: 'nodoPersonalizado',
          position: { x: fila.posicion_x, y: fila.posicion_y },
          data: {
            texto: fila.texto,
            hipervinculo: fila.hipervinculo || '',
            imagenUrl: fila.imagen_url || null,
            esRaiz: !fila.padre_id,
            color: fila.color || (!fila.padre_id ? COLOR_RAIZ : '#9fb3c8'),
            onCambiarTexto: cambiarTexto,
            onCambiarLink: cambiarLink,
            onCambiarImagen: cambiarImagen,
            onEliminar: eliminarNodo,
            onAgregarHijo: (id) => agregarHijoRef.current(id),
          },
        }));
        const edgesCargados = data
          .filter((fila) => fila.padre_id)
          .map((fila) => ({
            id: `e-${fila.padre_id}-${fila.id}`,
            source: fila.padre_id,
            target: fila.id,
            type: 'smoothstep',
            style: { stroke: fila.color || '#9fb3c8', strokeWidth: 2 },
          }));

        setNodes(nodosCargados);
        setEdges(edgesCargados);
      }
      setCargando(false);
    }

    cargarMapa();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onNodesChange = useCallback(
    (changes) => setNodes((nds) => applyNodeChanges(changes, nds)),
    []
  );

  const onNodeDragStop = useCallback(
    (_, nodo) => {
      const edge = edges.find((e) => e.target === nodo.id);
      guardarNodoEnDB(nodo, edge ? edge.source : null);
    },
    [edges, guardarNodoEnDB]
  );

  // --- Calcular cuantos descendientes tiene cada nodo (para el contador al colapsar) ---
  const conteoDescendientes = useMemo(() => {
    const mapa = {};
    function contar(id) {
      if (mapa[id] !== undefined) return mapa[id];
      const hijos = edges.filter((e) => e.source === id).map((e) => e.target);
      let total = hijos.length;
      hijos.forEach((h) => {
        total += contar(h);
      });
      mapa[id] = total;
      return total;
    }
    nodes.forEach((n) => contar(n.id));
    return mapa;
  }, [nodes, edges]);

  // --- Calcular que nodos quedan ocultos por estar dentro de una rama colapsada ---
  const idsOcultos = useMemo(() => {
    const ocultos = new Set();
    colapsados.forEach((id) => {
      const pila = edges.filter((e) => e.source === id).map((e) => e.target);
      while (pila.length) {
        const actual = pila.pop();
        if (!ocultos.has(actual)) {
          ocultos.add(actual);
          edges.filter((e) => e.source === actual).forEach((e) => pila.push(e.target));
        }
      }
    });
    return ocultos;
  }, [edges, colapsados]);

  const nodosVisibles = useMemo(
    () =>
      nodes
        .filter((n) => !idsOcultos.has(n.id))
        .map((n) => ({
          ...n,
          data: {
            ...n.data,
            tieneHijos: edges.some((e) => e.source === n.id),
            colapsado: colapsados.has(n.id),
            hijosOcultosCount: conteoDescendientes[n.id] || 0,
            onToggleColapso: toggleColapso,
          },
        })),
    [nodes, edges, idsOcultos, colapsados, conteoDescendientes, toggleColapso]
  );

  const edgesVisibles = useMemo(
    () => edges.filter((e) => !idsOcultos.has(e.source) && !idsOcultos.has(e.target)),
    [edges, idsOcultos]
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
          nodes={nodosVisibles}
          edges={edgesVisibles}
          onNodesChange={onNodesChange}
          onNodeDragStop={onNodeDragStop}
          nodeTypes={nodeTypes}
          fitView
        >
          <Controls />
          <MiniMap pannable zoomable />
        </ReactFlow>
      </div>
    </div>
  );
}
