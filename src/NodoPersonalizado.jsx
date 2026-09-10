import { useState, useRef, useEffect } from 'react';
import { Handle, Position } from 'reactflow';
import { supabase } from './supabaseClient';

function NodoPersonalizado({ id, data }) {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(data.texto);
  const [editandoLink, setEditandoLink] = useState(false);
  const [link, setLink] = useState(data.hipervinculo || '');
  const [subiendoImagen, setSubiendoImagen] = useState(false);
  const inputRef = useRef(null);
  const linkInputRef = useRef(null);
  const archivoInputRef = useRef(null);

  useEffect(() => {
    if (editando && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editando]);

  useEffect(() => {
    if (editandoLink && linkInputRef.current) {
      linkInputRef.current.focus();
    }
  }, [editandoLink]);

  const guardarTexto = () => {
    setEditando(false);
    if (texto !== data.texto) {
      data.onCambiarTexto(id, texto);
    }
  };

  const guardarLink = () => {
    setEditandoLink(false);
    if (link !== data.hipervinculo) {
      data.onCambiarLink(id, link);
    }
  };

  const subirImagen = async (archivo) => {
    if (!archivo) return;
    setSubiendoImagen(true);
    const extension = archivo.name.split('.').pop();
    const rutaArchivo = `${id}-${Date.now()}.${extension}`;

    const { error } = await supabase.storage
      .from('imagenes-nodos')
      .upload(rutaArchivo, archivo, { upsert: true });

    if (error) {
      console.error('Error subiendo imagen:', error);
      alert('No se pudo subir la imagen. Revisa que el bucket "imagenes-nodos" exista en Supabase.');
      setSubiendoImagen(false);
      return;
    }

    const { data: urlData } = supabase.storage
      .from('imagenes-nodos')
      .getPublicUrl(rutaArchivo);

    data.onCambiarImagen(id, urlData.publicUrl);
    setSubiendoImagen(false);
  };

  const colorRama = data.color || '#9fb3c8';

  const estiloNodo = data.esRaiz
    ? { borderColor: colorRama, borderWidth: 2, background: '#f4f6f9' }
    : { borderColor: colorRama, borderWidth: 1.5 };

  const estiloTexto = data.esRaiz ? { color: colorRama, fontWeight: 600 } : {};

  return (
    <div className="nodo-mapa" style={estiloNodo}>
      <Handle type="target" position={Position.Left} />

      {data.imagenUrl && (
        <div className="nodo-imagen-contenedor">
          <img src={data.imagenUrl} alt="" className="nodo-imagen" />
          <button
            className="nodo-imagen-quitar"
            title="Quitar imagen"
            onClick={(e) => {
              e.stopPropagation();
              data.onCambiarImagen(id, null);
            }}
          >
            ×
          </button>
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
              if (e.key === 'Escape') {
                setTexto(data.texto);
                setEditando(false);
              }
            }}
          />
        ) : (
          <span className="nodo-texto" style={estiloTexto} onDoubleClick={() => setEditando(true)}>
            {data.texto}
          </span>
        )}

        <div className="nodo-acciones">
          {data.hipervinculo && !editandoLink && (
            <a
              href={data.hipervinculo}
              target="_blank"
              rel="noopener noreferrer"
              className="nodo-link-icono"
              title={data.hipervinculo}
              onClick={(e) => e.stopPropagation()}
            >
              🔗
            </a>
          )}

          <input
            ref={archivoInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(e) => subirImagen(e.target.files[0])}
          />
          <button
            className="nodo-boton-imagen"
            title="Agregar imagen"
            onClick={(e) => {
              e.stopPropagation();
              archivoInputRef.current.click();
            }}
          >
            {subiendoImagen ? '…' : '🖼'}
          </button>

          <button
            className="nodo-boton-link"
            title="Agregar/editar hipervínculo"
            onClick={(e) => {
              e.stopPropagation();
              setEditandoLink(!editandoLink);
            }}
          >
            ⚙
          </button>

          <button
            className="nodo-boton-agregar"
            title="Agregar sub-nodo"
            onClick={(e) => {
              e.stopPropagation();
              data.onAgregarHijo(id);
            }}
          >
            +
          </button>

          <button
            className="nodo-boton-eliminar"
            title="Eliminar nodo"
            onClick={(e) => {
              e.stopPropagation();
              data.onEliminar(id);
            }}
          >
            ×
          </button>
        </div>
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
            onKeyDown={(e) => {
              if (e.key === 'Enter') guardarLink();
              if (e.key === 'Escape') setEditandoLink(false);
            }}
          />
        </div>
      )}

      <Handle type="source" position={Position.Right} />

      {data.tieneHijos && (
        <button
          className="nodo-toggle-colapso"
          style={{ borderColor: colorRama, color: colorRama }}
          onClick={(e) => {
            e.stopPropagation();
            data.onToggleColapso(id);
          }}
          title={data.colapsado ? 'Expandir' : 'Colapsar'}
        >
          {data.colapsado ? data.hijosOcultosCount : '−'}
        </button>
      )}
    </div>
  );
}

export default NodoPersonalizado;
