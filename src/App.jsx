import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import ReactFlow, {
  Controls,
  MiniMap,
  applyNodeChanges,
  BaseEdge,
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

// nodeTypes: registra el componente visual usado para dibujar cada nodo del mapa dentro de React Flow.
const nodeTypes = { nodoPersonalizado: NodoPersonalizado };
// edgeTypes: define un trazado personalizado para mantener un margen limpio alrededor del tronco vertical y del botón de colapso.
const edgeTypes = { mindmapBranch: MindmapBranchEdge };
// EMOJIS_RAPIDOS: conjunto de iconos disponibles para asignar a un nodo desde la barra de acciones.
const EMOJIS_RAPIDOS = ['📌', '✅', '⚠️', '⭐', '🔥', '🏷️', '🔖', '📎', '💡', '🚧'];

// MindmapBranchEdge: dibuja un conector con un tramo horizontal corto al salir del padre, un tronco vertical separado y una llegada limpia al hijo.
// Se mantiene la misma estructura del mapa y los nodos, pero se corrige solo el recorrido de la línea.
function MindmapBranchEdge({ id, sourceX, sourceY, targetX, targetY, style }) {
  const margenSalidaPadre = 22;
  const margenTronco = 38;
  const tramoHorizontalSalida = sourceX + margenSalidaPadre;
  const troncoX = sourceX + margenTronco;
  const tramoHorizontalLlegada = Math.max(targetX - 8, troncoX + 10);

  const path = [
    `M ${sourceX} ${sourceY}`,
    `H ${tramoHorizontalSalida}`,
    `V ${targetY}`,
    `H ${tramoHorizontalLlegada}`,
  ].join(' ');

  return <BaseEdge id={id} path={path} style={style} />;
}

// PALETA_RAMAS: colores reutilizados para diferenciar ramas hijas del nodo raíz.
const PALETA_RAMAS = ['#e0559a', '#f5a442', '#e0c93f', '#2fa88f', '#8e6fd1', '#4a90e2', '#e0554f'];
// COLOR_RAIZ: tonalidad base usada por el nodo principal del mapa mental.
const COLOR_RAIZ = '#334155';
// ANCHO_POR_DEFECTO: ancho inicial que usa un nodo nuevo cuando todavía no se ha ajustado manualmente.
// Este valor define el tamaño base del contenido visual del nodo antes de redimensionarlo.
const ANCHO_POR_DEFECTO = 120;
// ANCHO_HIJO_DIRECTO: tamaño más pequeño para los nodos que salen directamente del nodo raíz para mantener la jerarquía visual.
const ANCHO_HIJO_DIRECTO = 120;
// ANCHO_MINIMO: límite inferior para evitar nodos demasiado estrechos al redimensionar o al cargar datos antiguos.
const ANCHO_MINIMO = 75;
// SEPARACION_HORIZONTAL_HIJO: distancia horizontal mínima entre un nodo padre y el hijo que se crea.
// Se deja en un valor intermedio para acortar la conexión respecto al estado anterior, pero sin dejar las ramas demasiado pegadas ni superpuestas.
const SEPARACION_HORIZONTAL_HIJO = 40;

// obtenerAnchoNodo: normaliza el tamaño real del nodo para que siempre sea válido y consistente con el ancho visual.
// Si llega un valor vacío, no numérico o menor al mínimo, se devuelve el ancho por defecto.
function obtenerAnchoNodo(nodo) {
  const ancho = Number(nodo?.width ?? nodo?.data?.ancho ?? ANCHO_POR_DEFECTO);
  if (!Number.isFinite(ancho) || ancho < ANCHO_MINIMO) {
    return ANCHO_POR_DEFECTO;
  }
  return ancho;
}

// Lee los parámetros de la URL para decidir qué mapa abrir y si la vista es de solo lectura.
function obtenerParametrosURL() {
  const params = new URLSearchParams(window.location.search);
  return { mapaId: params.get('mapa'), soloLectura: params.get('solo') === '1' };
}

// Calcula la profundidad de un nodo dentro del árbol del mapa mental a partir de su estructura jerárquica.
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

// Normaliza la información de cada nodo para mantener propiedades derivadas como ancho y nivel consistentes.
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

// App: determina si se debe abrir la pantalla de inicio o el editor del mapa según la URL actual.
export default function App() {
  const { mapaId, soloLectura } = obtenerParametrosURL();

  if (!mapaId) {
    return <Home />;
  }

  return <EditorDeMapa mapaIdInicial={mapaId} soloLectura={soloLectura} />;
}

// EditorDeMapa: contiene la lógica principal del mapa mental: carga, edición, guardado, vistas y exportaciones.
function EditorDeMapa({ mapaIdInicial, soloLectura }) {
  // nodos: estado principal con todos los nodos del mapa y sus datos actuales.
  const [nodos, setNodos] = useState([]);
  // colapsados: conjunto de ids de nodos ocultos para comprimir ramas del mapa.
  const [colapsados, setColapsados] = useState(new Set());
  // cargando: indica si todavía se está leyendo el contenido del mapa desde Supabase.
  const [cargando, setCargando] = useState(true);
  // guardando: refleja si una operación de persistencia está en curso.
  const [guardando, setGuardando] = useState(false);
  // vista: controla si se muestra el mapa visual o la vista en esquema.
  const [vista, setVista] = useState('mapa'); // 'mapa' | 'esquema'
  // exportando: bloquea acciones mientras se genera un PNG o PDF del mapa.
  const [exportando, setExportando] = useState(false);
  // selectedNodeIds: nodos actualmente seleccionados para acciones masivas o de edición.
  const [selectedNodeIds, setSelectedNodeIds] = useState([]);
  // mostrarEmojiBarra: abre/cierra el panel de iconos rápidos del nodo activo.
  const [mostrarEmojiBarra, setMostrarEmojiBarra] = useState(false);
  // mostrarEditorLink: muestra el campo para editar el hipervínculo del nodo seleccionado.
  const [mostrarEditorLink, setMostrarEditorLink] = useState(false);
  // mostrarEditorNotas: activa el editor de notas del nodo seleccionado.
  const [mostrarEditorNotas, setMostrarEditorNotas] = useState(false);
  // linkBarra y notasBarra mantienen el texto temporal de los editores rápidos.
  const [linkBarra, setLinkBarra] = useState('');
  const [notasBarra, setNotasBarra] = useState('');
  // mapaId: referencia al identificador actual del mapa abierto para persistencia en Supabase.
  const mapaId = useRef(mapaIdInicial);
  // lienzoRef: referencia al contenedor del React Flow para exportar la imagen del mapa.
  const lienzoRef = useRef(null);
  // archivoBarraRef: referencia al input oculto para subir imágenes desde la barra de acciones.
  const archivoBarraRef = useRef(null);

  // Guarda un nodo individual en la tabla nodos de Supabase, incluyendo sus propiedades principales.
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

  // Elimina un nodo de la base de datos y reubica primero a sus hijos a nivel raíz antes de borrar el registro.
  const eliminarNodoEnDB = useCallback(async (id) => {
    setGuardando(true);
    await supabase.from('nodos').update({ padre_id: null }).eq('padre_id', id);
    await supabase.from('nodos').delete().eq('id', id);
    setGuardando(false);
  }, []);

  // Activa el modo de edición del texto del nodo indicado.
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

  // cambiaTexto: actualiza el texto principal de un nodo y lo sincroniza con la base de datos.
  const cambiarTexto = useCallback((id, nuevoTexto) => {
    setNodos((nds) => {
      const actualizados = nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, texto: nuevoTexto, editando: false } } : n));
      const nodo = actualizados.find((n) => n.id === id);
      const padreId = nodo?.data?.padreId || null;
      guardarNodoEnDB(nodo, padreId);
      return normalizarNodos(actualizados);
    });
  }, [guardarNodoEnDB]);

  // cambiaLink: guarda o limpia el enlace externo asociado al nodo actual.
  const cambiarLink = useCallback((id, nuevoLink) => {
    setNodos((nds) => {
      const actualizados = nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, hipervinculo: nuevoLink } } : n));
      const nodo = actualizados.find((n) => n.id === id);
      const padreId = nodo?.data?.padreId || null;
      guardarNodoEnDB(nodo, padreId);
      return normalizarNodos(actualizados);
    });
  }, [guardarNodoEnDB]);

  // cambiarImagen: asocia una imagen pública a un nodo y la persiste junto con el resto del contenido.
  const cambiarImagen = useCallback((id, nuevaImagenUrl) => {
    setNodos((nds) => {
      const actualizados = nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, imagenUrl: nuevaImagenUrl } } : n));
      const nodo = actualizados.find((n) => n.id === id);
      const padreId = nodo?.data?.padreId || null;
      guardarNodoEnDB(nodo, padreId);
      return normalizarNodos(actualizados);
    });
  }, [guardarNodoEnDB]);

  // cambiarNotas: guarda el contenido adicional del nodo para mostrarlo como detalle textual.
  const cambiarNotas = useCallback((id, nuevasNotas) => {
    setNodos((nds) => {
      const actualizados = nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, notas: nuevasNotas } } : n));
      const nodo = actualizados.find((n) => n.id === id);
      const padreId = nodo?.data?.padreId || null;
      guardarNodoEnDB(nodo, padreId);
      return normalizarNodos(actualizados);
    });
  }, [guardarNodoEnDB]);

  // cambiarForma: alterna entre los estilos visuales disponibles para un nodo: rectángulo, redondeado u oval.
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

  // cambiarIcono: asigna un emoji resumido al nodo para reforzar la identificación visual del tema.
  const cambiarIcono = useCallback((id, nuevoIcono) => {
    setNodos((nds) => {
      const actualizados = nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, icono: nuevoIcono } } : n));
      const nodo = actualizados.find((n) => n.id === id);
      const padreId = nodo?.data?.padreId || null;
      guardarNodoEnDB(nodo, padreId);
      return normalizarNodos(actualizados);
    });
  }, [guardarNodoEnDB]);

  // eliminarNodo: borra el nodo seleccionado y convierte a sus hijos en ramas raíz para no perder la estructura.
  const eliminarNodo = useCallback((id) => {
    setNodos((nds) => {
      const nodosActualizados = nds
        .filter((n) => n.id !== id)
        .map((n) => (n.data.padreId === id ? { ...n, data: { ...n.data, padreId: null } } : n));

      eliminarNodoEnDB(id);
      return normalizarNodos(nodosActualizados);
    });
  }, [eliminarNodoEnDB]);

  // toggleColapso: alterna la visibilidad de una rama completa para ocultar o expandir subnodos.
  const toggleColapso = useCallback((id) => {
    setColapsados((prev) => {
      const siguiente = new Set(prev);
      if (siguiente.has(id)) siguiente.delete(id);
      else siguiente.add(id);
      return siguiente;
    });
  }, []);

  // actualizarAnchoNodo: ajusta el tamaño del nodo en tiempo real y guarda el nuevo ancho para que se mantenga al recargar.
  // El ancho se actualiza en el objeto del nodo, en el style y en data.ancho para que React Flow y el guardado estén sincronizados.
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

  // crearNodo: fabrica la estructura base de un nodo nuevo con tamaño inicial, callbacks y propiedades visuales.
  // El ancho del nodo se define aquí para que cada nodo aparezca con un tamaño estándar antes de ser redimensionado por el usuario.
  // La raíz conserva su tamaño actual, mientras que los hijos directos de la raíz quedan más pequeños para reforzar la jerarquía visual.
  const crearNodo = useCallback((padreId, texto, posicion, esRaiz = false, color = COLOR_RAIZ, anchoInicial = ANCHO_POR_DEFECTO) => ({
    id: nanoid(8),
    type: 'nodoPersonalizado',
    position: posicion,
    width: anchoInicial,
    height: 56,
    style: { width: anchoInicial },
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
      ancho: anchoInicial,
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

  // agregarHijoRef: referencia para invocar la creación de subnodos desde callbacks dentro del árbol.
  const agregarHijoRef = useRef();

  // agregarHijo: crea un nodo hijo conectado a un nodo padre y lo guarda automáticamente.
  const agregarHijo = useCallback((padreId) => {
    setNodos((nds) => {
      const padre = nds.find((n) => n.id === padreId);
      if (!padre) return nds;

      const anchoPadre = obtenerAnchoNodo(padre);
      const hijosDelPadre = nds.filter((n) => n.data.padreId === padreId).length;
      const nivelPadre = calcularNivelNodo(padreId, nds);

      const nuevaPos = {
        x: padre.position.x + anchoPadre + SEPARACION_HORIZONTAL_HIJO,
        y: padre.position.y - 100 + hijosDelPadre * (nivelPadre >= 1 ? 40 : 60),
      };
      const colorAsignado = padre.data.esRaiz
        ? PALETA_RAMAS[hijosDelPadre % PALETA_RAMAS.length]
        : padre.data.color;
      const anchoInicial = padre.data.esRaiz ? ANCHO_HIJO_DIRECTO : ANCHO_POR_DEFECTO;

      const nuevoNodo = crearNodo(padreId, 'Nuevo nodo', nuevaPos, false, colorAsignado, anchoInicial);
      nuevoNodo.data.onAgregarHijo = agregarHijoRef.current;
      nuevoNodo.data.onRedimensionar = null;

      const proximo = normalizarNodos([...nds, nuevoNodo]);
      guardarNodoEnDB(nuevoNodo, padreId);

      return proximo;
    });
  }, [crearNodo, guardarNodoEnDB]);

  // Mantiene la referencia a agregarHijo actualizada para que otros componentes puedan invocarla sin depender del estado previo.
  useEffect(() => {
    agregarHijoRef.current = agregarHijo;
  }, [agregarHijo]);

  // cargarMapa: lee el contenido del mapa desde Supabase y crea la raíz si no existía aún.
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

  // onNodesChange: actualiza la posición y configuración de nodos del mapa al interactuar con React Flow.
  const onNodesChange = useCallback((changes) => {
    if (soloLectura) return;
    setNodos((nds) => normalizarNodos(applyNodeChanges(changes, nds)));
  }, [soloLectura]);

  // onNodeDragStop: guarda la posición final del nodo al soltarlo en el lienzo.
  const onNodeDragStop = useCallback((_, nodo) => {
    if (soloLectura) return;
    const padreId = nodos.find((n) => n.id === nodo.id)?.data?.padreId || null;
    guardarNodoEnDB(nodo, padreId);
  }, [nodos, guardarNodoEnDB, soloLectura]);

  // onNodeResize: mantiene el ancho del nodo al redimensionarlo en la interfaz visual.
  const onNodeResize = useCallback((_, nodo) => {
    if (soloLectura) return;
    if (!nodo?.id) return;
    actualizarAnchoNodo(nodo.id, nodo.width);
  }, [soloLectura, actualizarAnchoNodo]);

  // nodoSeleccionado: obtiene el nodo activo para mostrar sus acciones y campos de edición.
  const nodoSeleccionado = useMemo(
    () => (selectedNodeIds.length ? nodos.find((n) => n.id === selectedNodeIds[0]) || null : null),
    [selectedNodeIds, nodos]
  );

  // Sincroniza los campos temporales de enlace y notas con el nodo seleccionado para editarlo sin perder el contenido previo.
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

  // subirImagenDesdeBarra: carga una imagen desde el navegador y la almacena en el bucket de Supabase asociado al nodo.
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

  // guardarLinkDesdeBarra: persiste el hipervínculo editado del nodo activo.
  const guardarLinkDesdeBarra = () => {
    if (!nodoSeleccionado) return;
    cambiarLink(nodoSeleccionado.id, linkBarra);
    setMostrarEditorLink(false);
  };

  // guardarNotasDesdeBarra: guarda el texto adicional del nodo y oculta el editor rápido.
  const guardarNotasDesdeBarra = () => {
    if (!nodoSeleccionado) return;
    cambiarNotas(nodoSeleccionado.id, notasBarra);
    setMostrarEditorNotas(false);
  };

  // onSelectionChange: mantiene el listado de nodos seleccionados para acciones rápidas del teclado.
  const onSelectionChange = useCallback(({ nodes: seleccionados }) => {
    setSelectedNodeIds(seleccionados.map((n) => n.id));
  }, []);

  // onKeyDown: permite borrar nodos seleccionados con la tecla Delete, salvo que el mapa sea de solo lectura.
  const onKeyDown = useCallback((event) => {
    if (soloLectura) return; 
    if (event.key === 'Delete') {
      selectedNodeIds.forEach((id) => eliminarNodo(id));
    }
  }, [soloLectura, selectedNodeIds, eliminarNodo]);

  // edges: genera las conexiones visuales del árbol a partir de la relación padre-hijo de cada nodo.
  const edges = useMemo(
    () => nodos
      .filter((n) => n.data.padreId)
      .map((n) => ({
        id: `e-${n.data.padreId}-${n.id}`,
        source: n.data.padreId,
        target: n.id,
        type: 'mindmapBranch',
        style: { stroke: n.data.color || '#9fb3c8', strokeWidth: 2, fill: 'none' },
      })),
    [nodos]
  );

  // numeroHijosDirectos: cuenta cuántos subnodos tiene directamente una rama para mostrar la cantidad ocultada al colapsar.
  const numeroHijosDirectos = useCallback((id) => edges.filter((e) => e.source === id).length, [edges]);

  // idsOcultos: mantiene el conjunto de nodos que deben permanecer ocultos cuando una rama está colapsada.
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

  // nodosVisibles: devuelve la estructura final que se renderiza en el lienzo, con relaciones de colapso y visibilidad aplicadas.
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

  // edgesVisibles: filtra únicamente las conexiones que no pertenecen a ramas ocultas en el momento.
  const edgesVisibles = useMemo(
    () => edges.filter((e) => !idsOcultos.has(e.source) && !idsOcultos.has(e.target)),
    [edges, idsOcultos]
  );

  // copia un enlace de edición compartible del mapa actual para que otra persona pueda abrirlo.
  const copiarEnlaceCompartible = () => {
    navigator.clipboard.writeText(window.location.href.replace(/&solo=1/, ''));
    alert('¡Enlace copiado! (con permiso de edición)');
  };

  // copiarEnlaceSoloLectura: genera una URL con el parámetro solo=1 para compartir la vista no editable del mapa.
  const copiarEnlaceSoloLectura = () => {
    const url = new URL(window.location.href);
    url.searchParams.set('solo', '1');
    navigator.clipboard.writeText(url.toString());
    alert('¡Enlace de solo lectura copiado! Quien lo abra podrá ver pero no editar.');
  };

  // exportarPNG: convierte el contenido visible del lienzo en una imagen PNG descargable.
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

  // exportarPDF: genera un archivo PDF a partir del mapa visible, manteniendo la resolución de la imagen exportada.
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

  // Si todavía no se ha cargado el contenido del mapa desde Supabase, se muestra una pantalla temporal de carga.
  if (cargando) {
    return <div className="pantalla-carga">Cargando tu mapa mental…</div>;
  }

  // Render principal de la aplicación: cabecera con acciones globales, barra de edición del nodo seleccionado y lienzo del mapa.
  return (
    <div className="app-contenedor">
      <header className="app-header">
        {/* Cabecera superior: navegación general, indicador del modo actual y acciones de exportación y compartir. */}
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
        {/* Vista activa del mapa: puede mostrarse como tablero visual o como esquema jerárquico. */}
        {vista === 'mapa' ? (
          <>
            {/* Barra contextual de acciones del nodo activo: editar, cambiar forma, enlazar, añadir notas, imagen o eliminar. */}
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

            {/* Editor rápido para añadir o actualizar el hipervínculo del nodo seleccionado. */}
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

            {/* Editor rápido para anotar detalles adicionales del nodo seleccionado. */}
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

            {/* Contenedor del lienzo visual donde React Flow dibuja los nodos, sus conexiones y los controles del mapa. */}
            <div ref={lienzoRef} style={{ width: '100%', height: '100%' }}>
              <ReactFlow
                nodes={nodosVisibles}
                edges={edgesVisibles}
                onNodesChange={onNodesChange}
                onSelectionChange={onSelectionChange}
                onNodeDragStop={onNodeDragStop}
                onNodeResize={onNodeResize}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
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
