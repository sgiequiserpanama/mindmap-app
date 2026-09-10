import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import ReactFlow, {
  Controls,
  MiniMap,
  applyNodeChanges,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { nanoid } from 'nanoid';
import { toPng } from 'html-to-image';
import jsPDF from 'jspdf';
import NodoPersonalizado from './NodoPersonalizado';
import Home from './Home';
import Esquema from './Esquema';
import { supabase } from './supabaseClient';
import './styles.css';

const nodeTypes = { nodoPersonalizado: NodoPersonalizado };

const PALETA_RAMAS = ['#e0559a', '#f5a442', '#e0c93f', '#2fa88f', '#8e6fd1', '#4a90e2', '#e0554f'];
const COLOR_RAIZ = '#334155';

function obtenerParametrosURL() {
  const params = new URLSearchParams(window.location.search);
  return { mapaId: params.get('mapa'), soloLectura: params.get('solo') === '1' };
}

export default function App() {
  const { mapaId, soloLectura } = obtenerParametrosURL();

  if (!mapaId) {
    return <Home />;
  }

  return <EditorDeMapa mapaIdInicial={mapaId} soloLectura={soloLectura} />;
}

function EditorDeMapa({ mapaIdInicial, soloLectura }) {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [colapsados, setColapsados] = useState(new Set());
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [vista, setVista] = useState('mapa'); // 'mapa' | 'esquema'
  const [exportando, setExportando] = useState(false);
  const mapaId = useRef(mapaIdInicial);
  const lienzoRef = useRef(null);

  const guardarNodoEnDB = useCallback(async (nodo, padreId) => {
    if (soloLectura) return;
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
      notas: nodo.data.notas || null,
      forma: nodo.data.forma || null,
      icono: nodo.data.icono || null,
    });
    setGuardando(false);
  }, [soloLectura]);

  const eliminarNodoEnDB = useCallback(async (id) => {
    setGuardando(true);
    await supabase.from('nodos').delete().eq('id', id);
    setGuardando(false);
  }, []);

  const cambiarTexto = useCallback((id, nuevoTexto) => {
    setNodes((nds) => {
      const actualizados = nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, texto: nuevoTexto } } : n));
      const nodo = actualizados.find((n) => n.id === id);
      setEdges((eds) => {
        const edge = eds.find((e) => e.target === id);
        guardarNodoEnDB(nodo, edge ? edge.source : null);
        return eds;
      });
      return actualizados;
    });
  }, [guardarNodoEnDB]);

  const cambiarLink = useCallback((id, nuevoLink) => {
    setNodes((nds) => {
      const actualizados = nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, hipervinculo: nuevoLink } } : n));
      const nodo = actualizados.find((n) => n.id === id);
      setEdges((eds) => {
        const edge = eds.find((e) => e.target === id);
        guardarNodoEnDB(nodo, edge ? edge.source : null);
        return eds;
      });
      return actualizados;
    });
  }, [guardarNodoEnDB]);

  const cambiarImagen = useCallback((id, nuevaImagenUrl) => {
    setNodes((nds) => {
      const actualizados = nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, imagenUrl: nuevaImagenUrl } } : n));
      const nodo = actualizados.find((n) => n.id === id);
      setEdges((eds) => {
        const edge = eds.find((e) => e.target === id);
        guardarNodoEnDB(nodo, edge ? edge.source : null);
        return eds;
      });
      return actualizados;
    });
  }, [guardarNodoEnDB]);

  const cambiarNotas = useCallback((id, nuevasNotas) => {
    setNodes((nds) => {
      const actualizados = nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, notas: nuevasNotas } } : n));
      const nodo = actualizados.find((n) => n.id === id);
      setEdges((eds) => {
        const edge = eds.find((e) => e.target === id);
        guardarNodoEnDB(nodo, edge ? edge.source : null);
        return eds;
      });
      return actualizados;
    });
  }, [guardarNodoEnDB]);

  const cambiarForma = useCallback((id) => {
    setNodes((nds) => {
      const actualizados = nds.map((n) => {
        if (n.id !== id) return n;
        const formas = ['rectangulo', 'redondeado', 'ovalo'];
        const actual = formas.indexOf(n.data.forma || 'rectangulo');
        const siguiente = formas[(actual + 1) % formas.length];
        return { ...n, data: { ...n.data, forma: siguiente } };
      });
      const nodo = actualizados.find((n) => n.id === id);
      setEdges((eds) => {
        const edge = eds.find((e) => e.target === id);
        guardarNodoEnDB(nodo, edge ? edge.source : null);
        return eds;
      });
      return actualizados;
    });
  }, [guardarNodoEnDB]);

  const cambiarIcono = useCallback((id, nuevoIcono) => {
    setNodes((nds) => {
      const actualizados = nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, icono: nuevoIcono } } : n));
      const nodo = actualizados.find((n) => n.id === id);
      setEdges((eds) => {
        const edge = eds.find((e) => e.target === id);
        guardarNodoEnDB(nodo, edge ? edge.source : null);
        return eds;
      });
      return actualizados;
    });
  }, [guardarNodoEnDB]);

  const eliminarNodo = useCallback((id) => {
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
  }, [eliminarNodoEnDB]);

  const toggleColapso = useCallback((id) => {
    setColapsados((prev) => {
      const siguiente = new Set(prev);
      if (siguiente.has(id)) siguiente.delete(id);
      else siguiente.add(id);
      return siguiente;
    });
  }, []);

  const crearNodo = useCallback((texto, posicion, esRaiz = false, color = COLOR_RAIZ) => ({
    id: nanoid(8),
    type: 'nodoPersonalizado',
    position: posicion,
    data: {
      texto,
      hipervinculo: '',
      imagenUrl: null,
      notas: '',
      forma: 'rectangulo',
      icono: '',
      esRaiz,
      color,
      soloLectura,
      onCambiarTexto: cambiarTexto,
      onCambiarLink: cambiarLink,
      onCambiarImagen: cambiarImagen,
      onCambiarNotas: cambiarNotas,
      onCambiarForma: cambiarForma,
      onCambiarIcono: cambiarIcono,
      onEliminar: eliminarNodo,
      onAgregarHijo: null,
    },
  }), [soloLectura, cambiarTexto, cambiarLink, cambiarImagen, cambiarNotas, cambiarForma, cambiarIcono, eliminarNodo]);

  const agregarHijoRef = useRef();

  const agregarHijo = useCallback((padreId) => {
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
  }, [crearNodo, guardarNodoEnDB]);

  useEffect(() => {
    agregarHijoRef.current = agregarHijo;
  }, [agregarHijo]);

  useEffect(() => {
    async function cargarMapa() {
      setCargando(true);
      const { data, error } = await supabase.from('nodos').select('*').eq('mapa_id', mapaId.current);

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
        await supabase.from('mapas').upsert(
          { id: mapaId.current, nombre: 'Mapa sin nombre', carpeta: 'Sin carpeta' },
          { onConflict: 'id', ignoreDuplicates: true }
        );
      } else {
        const nodosCargados = data.map((fila) => ({
          id: fila.id,
          type: 'nodoPersonalizado',
          position: { x: fila.posicion_x, y: fila.posicion_y },
          data: {
            texto: fila.texto,
            hipervinculo: fila.hipervinculo || '',
            imagenUrl: fila.imagen_url || null,
            notas: fila.notas || '',
            forma: fila.forma || 'rectangulo',
            icono: fila.icono || '',
            esRaiz: !fila.padre_id,
            color: fila.color || (!fila.padre_id ? COLOR_RAIZ : '#9fb3c8'),
            soloLectura,
            onCambiarTexto: cambiarTexto,
            onCambiarLink: cambiarLink,
            onCambiarImagen: cambiarImagen,
            onCambiarNotas: cambiarNotas,
            onCambiarForma: cambiarForma,
            onCambiarIcono: cambiarIcono,
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

        const raizFila = data.find((f) => !f.padre_id);
        await supabase.from('mapas').upsert(
          { id: mapaId.current, nombre: raizFila ? raizFila.texto : 'Mapa sin nombre', carpeta: 'Sin carpeta' },
          { onConflict: 'id', ignoreDuplicates: true }
        );
      }
      setCargando(false);
    }

    cargarMapa();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onNodesChange = useCallback((changes) => {
    if (soloLectura) return;
    setNodes((nds) => applyNodeChanges(changes, nds));
  }, [soloLectura]);

  const onNodeDragStop = useCallback((_, nodo) => {
    if (soloLectura) return;
    const edge = edges.find((e) => e.target === nodo.id);
    guardarNodoEnDB(nodo, edge ? edge.source : null);
  }, [edges, guardarNodoEnDB, soloLectura]);

  const conteoDescendientes = useMemo(() => {
    const mapa = {};
    function contar(id) {
      if (mapa[id] !== undefined) return mapa[id];
      const hijos = edges.filter((e) => e.source === id).map((e) => e.target);
      let total = hijos.length;
      hijos.forEach((h) => { total += contar(h); });
      mapa[id] = total;
      return total;
    }
    nodes.forEach((n) => contar(n.id));
    return mapa;
  }, [nodes, edges]);

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

  const nodosVisibles = useMemo(() => nodes
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
    })), [nodes, edges, idsOcultos, colapsados, conteoDescendientes, toggleColapso]);

  const edgesVisibles = useMemo(
    () => edges.filter((e) => !idsOcultos.has(e.source) && !idsOcultos.has(e.target)),
    [edges, idsOcultos]
  );

  const copiarEnlaceCompartible = () => {
    navigator.clipboard.writeText(window.location.href.replace(/&solo=1/, ''));
    alert('¡Enlace copiado! (con permiso de edición)');
  };

  const copiarEnlaceSoloLectura = () => {
    const url = new URL(window.location.href);
    url.searchParams.set('solo', '1');
    navigator.clipboard.writeText(url.toString());
    alert('¡Enlace de solo lectura copiado! Quien lo abra podrá ver pero no editar.');
  };

  const exportarPNG = async () => {
    if (!lienzoRef.current) return;
    setExportando(true);
    try {
      const dataUrl = await toPng(lienzoRef.current, { backgroundColor: '#ffffff', pixelRatio: 2 });
      const enlace = document.createElement('a');
      enlace.download = 'mapa-mental.png';
      enlace.href = dataUrl;
      enlace.click();
    } catch (err) {
      console.error(err);
      alert('No se pudo exportar la imagen.');
    }
    setExportando(false);
  };

  const exportarPDF = async () => {
    if (!lienzoRef.current) return;
    setExportando(true);
    try {
      const dataUrl = await toPng(lienzoRef.current, { backgroundColor: '#ffffff', pixelRatio: 2 });
      const img = new Image();
      img.src = dataUrl;
      await new Promise((resolve) => { img.onload = resolve; });
      const pdf = new jsPDF({
        orientation: img.width > img.height ? 'landscape' : 'portrait',
        unit: 'px',
        format: [img.width, img.height],
      });
      pdf.addImage(dataUrl, 'PNG', 0, 0, img.width, img.height);
      pdf.save('mapa-mental.pdf');
    } catch (err) {
      console.error(err);
      alert('No se pudo exportar el PDF.');
    }
    setExportando(false);
  };

  if (cargando) {
    return <div className="pantalla-carga">Cargando tu mapa mental…</div>;
  }

  return (
    <div className="app-contenedor">
      <header className="app-header">
        <div className="app-header-izquierda">
          <a href={window.location.pathname} className="boton-volver" title="Volver a mis mapas">← Mis mapas</a>
          <h1>Mapa Mental{soloLectura ? ' (solo lectura)' : ''}</h1>
        </div>
        <div className="app-header-info">
          <button
            className={`boton-vista ${vista === 'mapa' ? 'activo' : ''}`}
            onClick={() => setVista('mapa')}
          >
            🗺 Mapa
          </button>
          <button
            className={`boton-vista ${vista === 'esquema' ? 'activo' : ''}`}
            onClick={() => setVista('esquema')}
          >
            📋 Esquema
          </button>
          <span className="contador-nodos">{nodes.length} nodos · sin límite</span>
          {!soloLectura && <span className="estado-guardado">{guardando ? 'Guardando…' : 'Guardado ✓'}</span>}
          <button className="boton-secundario" onClick={exportarPNG} disabled={exportando}>
            {exportando ? '…' : '⬇ PNG'}
          </button>
          <button className="boton-secundario" onClick={exportarPDF} disabled={exportando}>
            {exportando ? '…' : '⬇ PDF'}
          </button>
          {!soloLectura && (
            <button className="boton-secundario" onClick={copiarEnlaceSoloLectura}>
              🔒 Solo lectura
            </button>
          )}
          {!soloLectura && (
            <button className="boton-compartir" onClick={copiarEnlaceCompartible}>
              Compartir mapa
            </button>
          )}
        </div>
      </header>

      <div className="app-lienzo">
        {vista === 'mapa' ? (
          <div ref={lienzoRef} style={{ width: '100%', height: '100%' }}>
            <ReactFlow
              nodes={nodosVisibles}
              edges={edgesVisibles}
              onNodesChange={onNodesChange}
              onNodeDragStop={onNodeDragStop}
              nodeTypes={nodeTypes}
              nodesDraggable={!soloLectura}
              fitView
            >
              <Controls showInteractive={!soloLectura} />
              <MiniMap pannable zoomable />
            </ReactFlow>
          </div>
        ) : (
          <Esquema nodes={nodes} edges={edges} soloLectura={soloLectura} onCambiarTexto={cambiarTexto} />
        )}
      </div>
    </div>
  );
}
