import { useState, useRef, useEffect } from 'react';
import { Handle, Position, NodeResizer } from 'reactflow';

function NodoPersonalizado({ id, data }) {
  const [editando, setEditando] = useState(Boolean(data.editando));
  const [texto, setTexto] = useState(data.texto);
  const inputRef = useRef(null);
  const soloLectura = !!data.soloLectura;

  useEffect(() => {
    setEditando(Boolean(data.editando));
  }, [data.editando]);

  useEffect(() => {
    if (editando && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editando]);

  const guardarTexto = () => {
    setEditando(false);
    if (data.onCerrarEdicionTitulo) data.onCerrarEdicionTitulo(id);
    if (texto !== data.texto) data.onCambiarTexto(id, texto);
  };

  const colorRama = data.color || '#9fb3c8';
  const forma = data.forma || 'rectangulo';
  const nivel = Number(data.nivel ?? 0);
  const sinMarco = nivel >= 2;

  const claseForma =
    forma === 'ovalo' ? 'nodo-forma-ovalo' : forma === 'redondeado' ? 'nodo-forma-redondeado' : 'nodo-forma-rectangulo';

  const anchoNodo = Number(data.ancho ?? 260);
  const estiloNodo = {
    borderColor: colorRama,
    borderWidth: 1.5,
    width: `${Math.max(120, anchoNodo)}px`,
    minWidth: '120px',
    maxWidth: 'none',
  };
  const estiloTexto = data.esRaiz ? { color: colorRama, fontWeight: 600 } : {};

  return (
    <div className={`nodo-mapa ${claseForma} ${sinMarco ? 'nodo-sin-marco' : ''}`} style={estiloNodo}>
      {!soloLectura && (
        <NodeResizer
          minWidth={120}
          minHeight={42}
          handleStyle={{ width: 8, height: 8, borderRadius: 4, background: '#fff', border: '1px solid #cbd5e1' }}
          lineStyle={{ borderColor: colorRama, borderStyle: 'dashed' }}
          isVisible
        />
      )}
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

      {data.notas && (
        <div className="nodo-notas-vista" title="Notas del nodo">
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
          <span
            className="nodo-texto"
            style={estiloTexto}
            onDoubleClick={() => {
              if (!soloLectura) {
                setEditando(true);
                if (data.onEditarTitulo) data.onEditarTitulo(id);
              }
            }}
          >
            {data.icono ? `${data.icono} ` : ''}{data.texto}
          </span>
        )}

        {!soloLectura && (
          <div className="nodo-acciones">
            <button className="nodo-boton-agregar" title="Agregar sub-nodo" onClick={(e) => { e.stopPropagation(); data.onAgregarHijo(id); }}>
              +
            </button>
          </div>
        )}

        {data.hipervinculo && (
          <a href={data.hipervinculo} target="_blank" rel="noopener noreferrer" className="nodo-link-icono" title={data.hipervinculo} onClick={(e) => e.stopPropagation()}>
            🔗
          </a>
        )}
      </div>

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
