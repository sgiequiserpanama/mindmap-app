import { useState, useRef, useEffect } from 'react';
import { Handle, Position } from 'reactflow';
import { supabase } from './supabaseClient';

const EMOJIS_RAPIDOS = ['📌', '✅', '⚠️', '⭐', '🔥', '🏷️', '🔖', '📎', '💡', '🚧'];

function NodoPersonalizado({ id, data }) {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(data.texto);
  const [editandoLink, setEditandoLink] = useState(false);
  const [link, setLink] = useState(data.hipervinculo || '');
  const [editandoNotas, setEditandoNotas] = useState(false);
  const [notas, setNotas] = useState(data.notas || '');
  const [editandoNotas, setEditandoNotas] = useState(false);
  const [notas, setNotas] = useState(data.notas || '');
  const [subiendoImagen, setSubiendoImagen] = useState(false);
  const [mostrarEmojis, setMostrarEmojis] = useState(false);
  const [mostrarEmojis, setMostrarEmojis] = useState(false);
  const inputRef = useRef(null);
  const linkInputRef = useRef(null);
  const notasInputRef = useRef(null);
  const notasInputRef = useRef(null);
  const archivoInputRef = useRef(null);

  const soloLectura = !!data.soloLectura;

  useEffect(() => {
    if (editando && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editando]);

  useEffect(() => {
    if (editandoLink && linkInputRef.current) linkInputRef.current.focus();
  }, [editandoLink]);

  const guardarTexto = () => {
    setEditando(false);
    if (texto !== data.texto) data.onCambiarTexto(id, texto);
  };

  const guardarLink = () => {
    setEditandoLink(false);
    if (link !== data.hipervinculo) data.onCambiarLink(id, link);
  };

  const guardarNotas = () => {
    setEditandoNotas(false);
    if (notas !== data.notas) data.onCambiarNotas(id, notas);
  };

  const subirImagen = async (archivo) => {
    if (!archivo) return;
    setSubiendoImagen(true);
    const extension = archivo.name.split('.').pop();
    const rutaArchivo = `${id}-${Date.now()}.${extension}`;

    const { error } = await supabase.storage.from('imagenes-nodos').upload(rutaArchivo, archivo, { upsert: true });

    if (error) {
      console.error('Error subiendo imagen:', error);
      alert('No se pudo subir la imagen. Revisa que el bucket "imagenes-nodos" exista en Supabase.');
      setSubiendoImagen(false);
      return;
    }

    const { data: urlData } = supabase.storage.from('imagenes-nodos').getPublicUrl(rutaArchivo);
    data.onCambiarImagen(id, urlData.publicUrl);
    setSubiendoImagen(false);
  };

  const colorRama = data.color || '#9fb3c8';
  const forma = data.forma || 'rectangulo';

  const claseForma =
    forma === 'ovalo' ? 'nodo-forma-ovalo' : forma === 'redondeado' ? 'nodo-forma-redondeado' : 'nodo-forma-rectangulo';

  const estiloNodo = { borderColor: colorRama, borderWidth: 1.5 };

  const estiloTexto = data.esRaiz ? { color: colorRama, fontWeight: 600 } : {};

  return (
    <div className={`nodo-mapa ${claseForma}`} style={estiloNodo}>
      <Handle type="target" position={Position.Left} />

      {data.imagenUrl && (
        <div className="nodo-imagen-contenedor">
          <img src={data.imagenUrl} alt="" className="nodo-imagen" />
          {!soloLectura && (
            <button className="nodo-imagen-quitar" title="Quitar imagen" onClick={(e) => { e.stopPropagation(); data.onCambiarImagen(id, null); }}>
              ×
            </button>
          )}
        </div>
      )}

      {data.notas && !editandoNotas && (
        <div className="nodo-notas-vista" onDoubleClick={() => !soloLectura && setEditandoNotas(true)} title="Doble clic para editar">
          {data.notas}
        </div>
      )}

      <div className="nodo-contenido">
        {editando ? (
          <input
            ref={inputRef}
            className="nodo-input"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onBlur={guardarTexto}
            onKeyDown={(e) => {
              if (e.key === 'Enter') guardarTexto();
              if (e.key === 'Escape') { setTexto(data.texto); setEditando(false); }
            }}
          />
        ) : (
          <span className="nodo-texto" style={estiloTexto} onDoubleClick={() => !soloLectura && setEditando(true)}>
            {data.icono ? `${data.icono} ` : ''}{data.texto}
          </span>
        )}

        {!soloLectura && (
          <div className="nodo-acciones">
            {data.hipervinculo && !editandoLink && (
              <a href={data.hipervinculo} target="_blank" rel="noopener noreferrer" className="nodo-link-icono" title={data.hipervinculo} onClick={(e) => e.stopPropagation()}>
                🔗
              </a>
            )}
        {!soloLectura && (
          <div className="nodo-acciones">
            {data.hipervinculo && !editandoLink && (
              <a href={data.hipervinculo} target="_blank" rel="noopener noreferrer" className="nodo-link-icono" title={data.hipervinculo} onClick={(e) => e.stopPropagation()}>
                🔗
              </a>
            )}

            <div style={{ position: 'relative' }}>
              <button className="nodo-boton-emoji" title="Agregar icono" onClick={(e) => { e.stopPropagation(); setMostrarEmojis(!mostrarEmojis); }}>
                ⏺️
              </button>
              {mostrarEmojis && (
                <div className="nodo-emoji-panel nodrag nopan" onClick={(e) => e.stopPropagation()}>
                  {EMOJIS_RAPIDOS.map((em) => (
                    <button key={em} className="nodo-emoji-opcion" onClick={() => { data.onCambiarIcono(id, em); setMostrarEmojis(false); }}>
                      {em}
                    </button>
                  ))}
                  <button className="nodo-emoji-opcion" title="Quitar" onClick={() => { data.onCambiarIcono(id, ''); setMostrarEmojis(false); }}>
                    ∅
                  </button>
                </div>
              )}
            </div>

            <button
              className="nodo-boton-forma nodrag nopan"
              title="Cambiar forma"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); data.onCambiarForma(id); }}
            >
              ▱
            </button>

            <input ref={archivoInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => subirImagen(e.target.files[0])} />
            <button className="nodo-boton-imagen" title="Agregar imagen" onClick={(e) => { e.stopPropagation(); archivoInputRef.current.click(); }}>
              {subiendoImagen ? '…' : '🖼'}
            </button>

            <button className="nodo-boton-notas" title="Agregar/editar notas" onClick={(e) => { e.stopPropagation(); setEditandoNotas(!editandoNotas); }}>
              📝
            </button>

            <button className="nodo-boton-link" title="Agregar/editar hipervínculo" onClick={(e) => { e.stopPropagation(); setEditandoLink(!editandoLink); }}>
              ⚙
            </button>

            <button className="nodo-boton-agregar" title="Agregar sub-nodo" onClick={(e) => { e.stopPropagation(); data.onAgregarHijo(id); }}>
              +
            </button>

            <button className="nodo-boton-eliminar" title="Eliminar nodo" onClick={(e) => { e.stopPropagation(); data.onEliminar(id); }}>
              ×
            </button>
          </div>
        )}

        {soloLectura && data.hipervinculo && (
          <a href={data.hipervinculo} target="_blank" rel="noopener noreferrer" className="nodo-link-icono" title={data.hipervinculo} onClick={(e) => e.stopPropagation()}>
            🔗
          </a>
        )}
      </div>

      {editandoLink && (
        <div className="nodo-link-editor" onClick={(e) => e.stopPropagation()}>
          <input
            ref={linkInputRef}
            className="nodo-link-input"
            placeholder="https://..."
            value={link}
            onChange={(e) => setLink(e.target.value)}
            onBlur={guardarLink}
            onKeyDown={(e) => { if (e.key === 'Enter') guardarLink(); if (e.key === 'Escape') setEditandoLink(false); }}
          />
        </div>
      )}

      {editandoNotas && (
        <div className="nodo-link-editor" onClick={(e) => e.stopPropagation()}>
          <textarea
            ref={notasInputRef}
            className="nodo-notas-input"
            placeholder="Escribe una nota..."
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            onBlur={guardarNotas}
            onKeyDown={(e) => { if (e.key === 'Escape') setEditandoNotas(false); }}
            autoFocus
          />
        </div>
      )}

      <Handle type="source" position={Position.Right} />

      {data.tieneHijos && (
        <button
          className="nodo-toggle-colapso nodrag nopan"
          style={{ borderColor: colorRama, color: colorRama, zIndex: 30, pointerEvents: 'auto' }}
          onClick={(e) => { e.stopPropagation(); data.onToggleColapso(id); }}
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          title={data.colapsado ? 'Expandir' : 'Colapsar'}
        >
          {data.colapsado ? data.hijosOcultosCount : '−'}
        </button>
      )}
    </div>
  );
}

export default NodoPersonalizado;
