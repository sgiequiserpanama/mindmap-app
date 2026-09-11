import { useState } from 'react';

function FilaEsquema({ nodo, hijos, nodesById, edgesPorPadre, nivel, soloLectura, onCambiarTexto }) {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(nodo.data.texto);

  const guardar = () => {
    setEditando(false);
    if (texto !== nodo.data.texto) onCambiarTexto(nodo.id, texto);
  };

  return (
    <div className="esquema-item" style={{ marginLeft: nivel * 22 }}>
      <div className="esquema-linea" style={{ borderLeftColor: nodo.data.color || '#9fb3c8' }}>
        {editando ? (
          <input
            className="esquema-input"
            value={texto}
            autoFocus
            onChange={(e) => setTexto(e.target.value)}
            onBlur={guardar}
            onKeyDown={(e) => {
              if (e.key === 'Enter') guardar();
              if (e.key === 'Escape') { setTexto(nodo.data.texto); setEditando(false); }
            }}
          />
        ) : (
          <span
            className="esquema-texto"
            onDoubleClick={() => !soloLectura && setEditando(true)}
            style={{ color: nodo.data.color || '#2c3e50' }}
          >
            {nodo.data.icono ? `${nodo.data.icono} ` : ''}{nodo.data.texto}
          </span>
        )}
      </div>
      {hijos.map((hijoId) => (
        <FilaEsquema
          key={hijoId}
          nodo={nodesById[hijoId]}
          hijos={(edgesPorPadre[hijoId] || [])}
          nodesById={nodesById}
          edgesPorPadre={edgesPorPadre}
          nivel={nivel + 1}
          soloLectura={soloLectura}
          onCambiarTexto={onCambiarTexto}
        />
      ))}
    </div>
  );
}

export default function Esquema({ nodes, edges, soloLectura, onCambiarTexto }) {
  const nodesById = {};
  nodes.forEach((n) => { nodesById[n.id] = n; });

  const edgesPorPadre = {};
  edges.forEach((e) => {
    if (!edgesPorPadre[e.source]) edgesPorPadre[e.source] = [];
    edgesPorPadre[e.source].push(e.target);
  });

  const raiz = nodes.find((n) => n.data.esRaiz);

  if (!raiz) return <div className="pantalla-carga">Sin datos</div>;

  return (
    <div className="esquema-contenedor">
      <FilaEsquema
        nodo={raiz}
        hijos={edgesPorPadre[raiz.id] || []}
        nodesById={nodesById}
        edgesPorPadre={edgesPorPadre}
        nivel={0}
        soloLectura={soloLectura}
        onCambiarTexto={onCambiarTexto}
      />
    </div>
  );
}
