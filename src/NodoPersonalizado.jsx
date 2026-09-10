import { useState, useRef, useEffect } from 'react';
import { Handle, Position } from 'reactflow';

function NodoPersonalizado({ id, data }) {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(data.texto);
  const [editandoLink, setEditandoLink] = useState(false);
  const [link, setLink] = useState(data.hipervinculo || '');
  const inputRef = useRef(null);
  const linkInputRef = useRef(null);

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

  return (
    <div className={`nodo-mapa ${data.esRaiz ? 'nodo-raiz' : ''}`}>
      <Handle type="target" position={Position.Left} />

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
          <span className="nodo-texto" onDoubleClick={() => setEditando(true)}>
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
    </div>
  );
}

export default NodoPersonalizado;
