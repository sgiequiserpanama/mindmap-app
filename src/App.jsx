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
const EMOJIS_RAPIDOS = ['📌', '✅', '⚠️', '⭐', '🔥', '🏷️', '🔖', '📎', '💡', '🚧'];

const PALETA_RAMAS = ['#e0559a', '#f5a442', '#e0c93f', '#2fa88f', '#8e6fd1', '#4a90e2', '#e0554f'];
const COLOR_RAIZ = '#334155';
const ANCHO_POR_DEFECTO = 260;
const ANCHO_MINIMO = 120;

function obtenerAnchoNodo(nodo) {
  const ancho = Number(nodo?.width ?? nodo?.data?.ancho ?? ANCHO_POR_DEFECTO);
  if (!Number.isFinite(ancho) || ancho < ANCHO_MINIMO) {
    return ANCHO_POR_DEFECTO;
  }
  return ancho;
}

function obtenerParametrosURL() {
  const params = new URLSearchParams(window.location.search);
  return { mapaId: params.get('mapa'), soloLectura: params.get('solo') === '1' };
}

function calcularNivelNodo(id, nodos, cache = new Map()) {
  if (cache.has(id)) return cache.get(id);

  const nodo = nodos.find((n) => n.id === id);
  if (!nodo || !nodo.data?.padreId) {
    cache.set(id, 0);
    return 0;
  }

  const padre = nodos.find((n) => n.id === nodo.data.padreId);
  if (!padre) {
    cache.set(id, 0);
    return 0;
  }

  const nivelPadre = calcularNivelNodo(padre.id, nodos, cache);
  const nivel = nivelPadre + 1;
  cache.set(id, nivel);
  return nivel;
}

function normalizarNodos(nodos) {
  const cache = new Map();
  return nodos.map((nodo) => {
    const ancho = obtenerAnchoNodo(nodo);
    return {
      ...nodo,
      width: ancho,
      style: {
        ...nodo.style,
        width: ancho,
      },
      data: {
        ...nodo.data,
        ancho,
        nivel: calcularNivelNodo(nodo.id, nodos, cache),
      },
    };
  });
}

export default function App() {
  const { mapaId, soloLectura } = obtenerParametrosURL();

  if (!mapaId) {
    return <Home />;
  }

  return <EditorDeMapa mapaIdInicial={mapaId} soloLectura={soloLectura} />;
}

function EditorDeMapa({ mapaIdInicial, soloLectura }) {
  const [nodos, setNodos] = useState([]);
  const [colapsados, setColapsados] = useState(new Set());
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [vista, setVista] = useState('mapa'); // 'mapa' | 'esquema'
  const [exportando, setExportando] = useState(false);
  const [selectedNodeIds, setSelectedNodeIds] = useState([]);
  const [mostrarEmojiBarra, setMostrarEmojiBarra] = useState(false);
  const [mostrarEditorLink, setMostrarEditorLink] = useState(false);
  const [mostrarEditorNotas, setMostrarEditorNotas] = useState(false);
  const [linkBarra, setLinkBarra] = useState('');
  const [notasBarra, setNotasBarra] = useState('');
  const mapaId = useRef(mapaIdInicial);
  const lienzoRef = useRef(null);
  const archivoBarraRef = useRef(null);

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
      ancho: obtenerAnchoNodo(nodo),
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
    await supabase.from('nodos').update({ padre_id: null }).eq('padre_id', id);
    await supabase.from('nodos').delete().eq('id', id);
    setGuardando(false);
  }, []);

  const abrirEdicionTitulo = useCallback((id) => {
    setNodos((nds) => nds.map((n) => ({
      ...n,
      data: {
        ...n.data,
        editando: n.id === id,
      },
    })));
  }, []);

  const cerrarEdicionTitulo = useCallback((id) => {
    setNodos((nds) => nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, editando: false } } : n)));
  }, []);

  const cambiarTexto = useCallback((id, nuevoTexto) => {
    setNodos((nds) => {
      const actualizados = nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, texto: nuevoTexto, editando: false } } : n));
      const nodo = actualizados.find((n) => n.id === id);
      const padreId = nodo?.data?.padreId || null;
      guardarNodoEnDB(nodo, padreId);
      return normalizarNodos(actualizados);
    });
  }, [guardarNodoEnDB]);

  const cambiarLink = useCallback((id, nuevoLink) => {
    setNodos((nds) => {
      const actualizados = nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, hipervinculo: nuevoLink } } : n));
      const nodo = actualizados.find((n) => n.id === id);
      const padreId = nodo?.data?.padreId || null;
      guardarNodoEnDB(nodo, padreId);
      return normalizarNodos(actualizados);
    });
  }, [guardarNodoEnDB]);

  const cambiarImagen = useCallback((id, nuevaImagenUrl) => {
    setNodos((nds) => {
      const actualizados = nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, imagenUrl: nuevaImagenUrl } } : n));
      const nodo = actualizados.find((n) => n.id === id);
      const padreId = nodo?.data?.padreId || null;
      guardarNodoEnDB(nodo, padreId);
      return normalizarNodos(actualizados);
    });
  }, [guardarNodoEnDB]);

  const cambiarNotas = useCallback((id, nuevasNotas) => {
    setNodos((nds) => {
      const actualizados = nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, notas: nuevasNotas } } : n));
      const nodo = actualizados.find((n) => n.id === id);
      const padreId = nodo?.data?.padreId || null;
      guardarNodoEnDB(nodo, padreId);
      return normalizarNodos(actualizados);
    });
  }, [guardarNodoEnDB]);

  const cambiarForma = useCallback((id) => {
    setNodos((nds) => {
      const actualizados = nds.map((n) => {
        if (n.id !== id) return n;
        const formas = ['rectangulo', 'redondeado', 'ovalo'];
        const actual = formas.indexOf(n.data.forma || 'rectangulo');
        const siguiente = formas[(actual + 1) % formas.length];
        return { ...n, data: { ...n.data, forma: siguiente } };
      });
      const nodo = actualizados.find((n) => n.id === id);
      const padreId = nodo?.data?.padreId || null;
      guardarNodoEnDB(nodo, padreId);
      return normalizarNodos(actualizados);
    });
  }, [guardarNodoEnDB]);

  const cambiarIcono = useCallback((id, nuevoIcono) => {
    setNodos((nds) => {
      const actualizados = nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, icono: nuevoIcono } } : n));
      const nodo = actualizados.find((n) => n.id === id);
      const padreId = nodo?.data?.padreId || null;
      guardarNodoEnDB(nodo, padreId);
      return normalizarNodos(actualizados);
    });
  }, [guardarNodoEnDB]);

  const eliminarNodo = useCallback((id) => {
    setNodos((nds) => {
      const nodosActualizados = nds
        .filter((n) => n.id !== id)
        .map((n) => (n.data.padreId === id ? { ...n, data: { ...n.data, padreId: null } } : n));

      eliminarNodoEnDB(id);
      return normalizarNodos(nodosActualizados);
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

  const actualizarAnchoNodo = useCallback((id, ancho, nuevaX) => {
    setNodos((nds) => {
      const actualizados = nds.map((n) => {
        if (n.id !== id) return n;
        const siguienteAncho = Math.max(ANCHO_MINIMO, Number(ancho) || ANCHO_POR_DEFECTO);
        const nuevaPosicion = nuevaX !== undefined ? { ...n.position, x: nuevaX } : n.position;
        return {
          ...n,
          width: siguienteAncho,
          position: nuevaPosicion,
          style: { ...n.style, width: siguienteAncho },
          data: {
            ...n.data,
            ancho: siguienteAncho,
          },
        };
      });
      const nodo = actualizados.find((n) => n.id === id);
      if (nodo) {
        guardarNodoEnDB(nodo, nodo.data.padreId || null);
      }
      return normalizarNodos(actualizados);
    });
  }, [guardarNodoEnDB]);

  const crearNodo = useCallback((padreId, texto, posicion, esRaiz = false, color = COLOR_RAIZ) => ({
    id: nanoid(8),
    type: 'nodoPersonalizado',
    position: posicion,
    width: ANCHO_POR_DEFECTO,
    height: 56,
    style: { width: ANCHO_POR_DEFECTO },
    resizable: true,
    data: {
      padreId,
      texto,
      hipervinculo: '',
      imagenUrl: null,
      notas: '',
      forma: 'rectangulo',
      icono: '',
      esRaiz,
      color,
      ancho: ANCHO_POR_DEFECTO,
      soloLectura,
      editando: false,
      onCambiarTexto: cambiarTexto,
      onCambiarLink: cambiarLink,
      onCambiarImagen: cambiarImagen,
      onCambiarNotas: cambiarNotas,
      onCambiarForma: cambiarForma,
      onCambiarIcono: cambiarIcono,
      onEliminar: eliminarNodo,
      onAgregarHijo: null,
      onEditarTitulo: abrirEdicionTitulo,
      onCerrarEdicionTitulo: cerrarEdicionTitulo,
      onRedimensionar: actualizarAnchoNodo,
    },
  }), [soloLectura, cambiarTexto, cambiarLink, cambiarImagen, cambiarNotas, cambiarForma, cambiarIcono, eliminarNodo, abrirEdicionTitulo, cerrarEdicionTitulo, actualizarAnchoNodo]);

  const agregarHijoRef = useRef();

  const agregarHijo = useCallback((padreId) => {
    setNodos((nds) => {
      const padre = nds.find((n) => n.id === padreId);
      if (!padre) return nds;

      const anchoPadre = obtenerAnchoNodo(padre);
      const hijosDelPadre = nds.filter((n) => n.data.padreId === padreId).length;
      const nivelPadre = calcularNivelNodo(padreId, nds);

      const nuevaPos = {
        x: padre.position.x + anchoPadre + 50,
        y: padre.position.y - 100 + hijosDelPadre * (nivelPadre >= 1 ? 40 : 60),
      };
      const colorAsignado = padre.data.esRaiz
        ? PALETA_RAMAS[hijosDelPadre % PALETA_RAMAS.length]
        : padre.data.color;

      const nuevoNodo = crearNodo(padreId, 'Nuevo nodo', nuevaPos, false, colorAsignado);
      nuevoNodo.data.onAgregarHijo = agregarHijoRef.current;
      nuevoNodo.data.onRedimensionar = null;

      const proximo = normalizarNodos([...nds, nuevoNodo]);
      guardarNodoEnDB(nuevoNodo, padreId);

      return proximo;
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
        const raiz = crearNodo('', 'Tema central', { x: 50, y: 200 }, true, COLOR_RAIZ);
        raiz.data.onAgregarHijo = (id) => agregarHijoRef.current(id);
        raiz.data.onRedimensionar = null;
        raiz.resizable = true;
        setNodos(normalizarNodos([raiz]));
        guardarNodoEnDB(raiz, null);
        await supabase.from('mapas').upsert(
          { id: mapaId.current, nombre: 'Mapa sin nombre', carpeta: 'Sin carpeta' },
          { onConflict: 'id', ignoreDuplicates: true }
        );
      } else {
        const nodosCargados = normalizarNodos(data.map((fila) => {
          const ancho = Number(fila.ancho ?? ANCHO_POR_DEFECTO);
          return {
            id: fila.id,
            type: 'nodoPersonalizado',
            position: { x: fila.posicion_x, y: fila.posicion_y },
            width: ancho,
            height: 56,
            style: { width: ancho },
            resizable: true,
            data: {
              padreId: fila.padre_id || null,
              texto: fila.texto,
              hipervinculo: fila.hipervinculo || '',
              imagenUrl: fila.imagen_url || null,
              notas: fila.notas || '',
              forma: fila.forma || 'rectangulo',
              icono: fila.icono || '',
              esRaiz: !fila.padre_id,
              color: fila.color || (!fila.padre_id ? COLOR_RAIZ : '#9fb3c8'),
              ancho,
              soloLectura,
              editando: false,
              onCambiarTexto: cambiarTexto,
              onCambiarLink: cambiarLink,
              onCambiarImagen: cambiarImagen,
              onCambiarNotas: cambiarNotas,
              onCambiarForma: cambiarForma,
              onCambiarIcono: cambiarIcono,
              onEliminar: eliminarNodo,
              onAgregarHijo: (id) => agregarHijoRef.current(id),
              onEditarTitulo: abrirEdicionTitulo,
              onCerrarEdicionTitulo: cerrarEdicionTitulo,
              onRedimensionar: null,
            },
          };
        }));

        setNodos(nodosCargados);

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
    setNodos((nds) => normalizarNodos(applyNodeChanges(changes, nds)));
  }, [soloLectura]);

  const onNodeDragStop = useCallback((_, nodo) => {
    if (soloLectura) return;
    const padreId = nodos.find((n) => n.id === nodo.id)?.data?.padreId || null;
    guardarNodoEnDB(nodo, padreId);
  }, [nodos, guardarNodoEnDB, soloLectura]);

  const onNodeResize = useCallback((_, nodo) => {
    if (soloLectura) return;
    if (!nodo?.id) return;
    actualizarAnchoNodo(nodo.id, nodo.width);
  }, [soloLectura, actualizarAnchoNodo]);

  const nodoSeleccionado = useMemo(
    () => (selectedNodeIds.length ? nodos.find((n) => n.id === selectedNodeIds[0]) || null : null),
    [selectedNodeIds, nodos]
  );

  useEffect(() => {
    if (!nodoSeleccionado) {
      setMostrarEmojiBarra(false);
      setMostrarEditorLink(false);
      setMostrarEditorNotas(false);
      return;
    }

    setLinkBarra(nodoSeleccionado.data.hipervinculo || '');
    setNotasBarra(nodoSeleccionado.data.notas || '');
  }, [nodoSeleccionado]);

  const subirImagenDesdeBarra = async (archivo) => {
    if (!archivo || !nodoSeleccionado) return;

    const extension = archivo.name.split('.').pop();
    const rutaArchivo = `${nodoSeleccionado.id}-${Date.now()}.${extension}`;
    const { error } = await supabase.storage.from('imagenes-nodos').upload(rutaArchivo, archivo, { upsert: true });

    if (error) {
      console.error('Error subiendo imagen:', error);
      alert('No se pudo subir la imagen. Revisa que el bucket "imagenes-nodos" exista en Supabase.');
      return;
    }

    const { data: urlData } = supabase.storage.from('imagenes-nodos').getPublicUrl(rutaArchivo);
    cambiarImagen(nodoSeleccionado.id, urlData.publicUrl);
  };

  const guardarLinkDesdeBarra = () => {
    if (!nodoSeleccionado) return;
    cambiarLink(nodoSeleccionado.id, linkBarra);
    setMostrarEditorLink(false);
  };

  const guardarNotasDesdeBarra = () => {
    if (!nodoSeleccionado) return;
    cambiarNotas(nodoSeleccionado.id, notasBarra);
    setMostrarEditorNotas(false);
  };

  const onSelectionChange = useCallback(({ nodes: seleccionados }) => {
    setSelectedNodeIds(seleccionados.map((n) => n.id));
  }, []);

  const onKeyDown = useCallback((event) => {
    if (soloLectura) return; 
    if (event.key === 'Delete') {
      selectedNodeIds.forEach((id) => eliminarNodo(id));
    }
  }, [soloLectura, selectedNodeIds, eliminarNodo]);

  const edges = useMemo(
    () => nodos
      .filter((n) => n.data.padreId)
      .map((n) => ({
        id: `e-${n.data.padreId}-${n.id}`,
        source: n.data.padreId,
        target: n.id,
        type: 'smoothstep',
        style: { stroke: n.data.color || '#9fb3c8', strokeWidth: 2 },
      })),
    [nodos]
  );

  const numeroHijosDirectos = useCallback((id) => edges.filter((e) => e.source === id).length, [edges]);

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

  const nodosVisibles = useMemo(() => {
    return normalizarNodos(
      nodos
        .filter((n) => !idsOcultos.has(n.id))
        .map((n) => ({
          ...n,
          data: {
            ...n.data,
            tieneHijos: edges.some((e) => e.source === n.id),
            colapsado: colapsados.has(n.id),
            hijosOcultosCount: colapsados.has(n.id) ? numeroHijosDirectos(n.id) : 0,
            onToggleColapso: toggleColapso,
          },
        }))
    );
  }, [nodos, edges, idsOcultos, colapsados, numeroHijosDirectos, toggleColapso]);

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
          <span className="contador-nodos">{nodos.length} nodos · sin límite</span>
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
          <>
            <div className="barra-acciones-nodo">
              {nodoSeleccionado ? (
                <>
                  <button
                    className="boton-barra-accion"
                    type="button"
                    onClick={() => nodoSeleccionado?.data?.onEditarTitulo?.(nodoSeleccionado.id)}
                  >
                    ✏️ Título
                  </button>

                  <div className="barra-accion-grupo barra-accion-emoji">
                    <button
                      className="boton-barra-accion"
                      type="button"
                      onClick={() => setMostrarEmojiBarra((v) => !v)}
                    >
                      ⏺️ Icono
                    </button>
                    {mostrarEmojiBarra && (
                      <div className="barra-emoji-panel">
                        {EMOJIS_RAPIDOS.map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            className="barra-emoji-opcion"
                            onClick={() => {
                              cambiarIcono(nodoSeleccionado.id, emoji);
                              setMostrarEmojiBarra(false);
                            }}
                          >
                            {emoji}
                          </button>
                        ))}
                        <button
                          type="button"
                          className="barra-emoji-opcion quitar"
                          onClick={() => {
                            cambiarIcono(nodoSeleccionado.id, '');
                            setMostrarEmojiBarra(false);
                          }}
                        >
                          ∅
                        </button>
                      </div>
                    )}
                  </div>

                  <button
                    className="boton-barra-accion"
                    type="button"
                    onClick={() => cambiarForma(nodoSeleccionado.id)}
                  >
                    ▱ Forma
                  </button>

                  <button
                    className="boton-barra-accion"
                    type="button"
                    onClick={() => eliminarNodo(nodoSeleccionado.id)}
                    style={{ color: '#d94a4a' }}
                  >
                    🗑 Eliminar
                  </button>

                  <input
                    ref={archivoBarraRef}
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={(event) => {
                      subirImagenDesdeBarra(event.target.files[0]);
                      event.target.value = '';
                    }}
                  />
                  <button
                    className="boton-barra-accion"
                    type="button"
                    onClick={() => archivoBarraRef.current?.click()}
                  >
                    🖼 Imagen
                  </button>

                  <button
                    className="boton-barra-accion"
                    type="button"
                    onClick={() => {
                      setMostrarEditorNotas((value) => !value);
                      setMostrarEditorLink(false);
                    }}
                  >
                    📝 Notas
                  </button>

                  <button
                    className="boton-barra-accion"
                    type="button"
                    onClick={() => {
                      setMostrarEditorLink((value) => !value);
                      setMostrarEditorNotas(false);
                    }}
                  >
                    🔗 Link
                  </button>

                </>
              ) : (
                <span className="barra-acciones-vacia">Selecciona un nodo para editarlo</span>
              )}
            </div>

            {mostrarEditorLink && nodoSeleccionado && (
              <div className="barra-editor"> 
                <input
                  className="barra-editor-input"
                  value={linkBarra}
                  onChange={(event) => setLinkBarra(event.target.value)}
                  placeholder="https://..."
                  autoFocus
                />
                <button className="boton-barra-guardar" type="button" onClick={guardarLinkDesdeBarra}>Guardar</button>
              </div>
            )}

            {mostrarEditorNotas && nodoSeleccionado && (
              <div className="barra-editor barra-editor-notas">
                <textarea
                  className="barra-editor-textarea"
                  value={notasBarra}
                  onChange={(event) => setNotasBarra(event.target.value)}
                  placeholder="Escribe una nota..."
                  autoFocus
                />
                <button className="boton-barra-guardar" type="button" onClick={guardarNotasDesdeBarra}>Guardar</button>
              </div>
            )}

            <div ref={lienzoRef} style={{ width: '100%', height: '100%' }}>
              <ReactFlow
                nodes={nodosVisibles}
                edges={edgesVisibles}
                onNodesChange={onNodesChange}
                onSelectionChange={onSelectionChange}
                onNodeDragStop={onNodeDragStop}
                onNodeResize={onNodeResize}
                nodeTypes={nodeTypes}
                nodesDraggable={!soloLectura}
                nodesSelectable={!soloLectura}
                elementsSelectable={!soloLectura}
                onKeyDown={onKeyDown}
                fitView
              >
                <Controls showInteractive={!soloLectura} />
                <MiniMap pannable zoomable />
              </ReactFlow>
            </div>
          </>
        ) : (
          <Esquema nodes={nodosVisibles} edges={edgesVisibles} soloLectura={soloLectura} onCambiarTexto={cambiarTexto} />
        )}
      </div>
    </div>
  );
}
