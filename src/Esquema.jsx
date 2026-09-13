import { useState } from 'react';

function NodoEsquema({ nodo, nodesById, edgesPorPadre, nivel, soloLectura, onCambiarTexto, esRaiz = false }) {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(nodo.data.texto);

  const guardar = () => {
    setEditando(false);
    if (texto !== nodo.data.texto) onCambiarTexto(nodo.id, texto);
  };

  const hijos = edgesPorPadre[nodo.id] || [];
  const esTextoLibre = !esRaiz && nivel > 1;

  const contenido = editando ? (
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
    <div className="esquema-celda">
      {!esRaiz && <span className="esquema-numero" style={{ background: nodo.data.color || '#2d6cdf' }}>{nivel}</span>}
      <span
        className="esquema-texto"
        onDoubleClick={() => !soloLectura && setEditando(true)}
        style={{ color: nodo.data.color || '#2c3e50' }}
      >
        {nodo.data.icono ? `${nodo.data.icono} ` : ''}{nodo.data.texto}
      </span>
    </div>
  );

  return (
    <div className={`esquema-frame ${esRaiz ? 'esquema-frame-root' : 'esquema-frame-branch'}`}>
      <div
        className={`esquema-nodo ${esRaiz ? 'esquema-raiz' : `esquema-hijo ${esTextoLibre ? 'esquema-hijo-libre' : ''}`}`}
        style={esRaiz ? { borderColor: nodo.data.color || '#2d6cdf' } : { borderColor: esTextoLibre ? 'transparent' : nodo.data.color || '#5ab1ee' }}
      >
        {esRaiz ? (
          <div className="esquema-raiz-contenido">
            <div className="esquema-raiz-titulo">{nodo.data.texto}</div>
          </div>
        ) : contenido}
      </div>

      {hijos.length > 0 && (
        <div className="esquema-children">
          {hijos.map((hijoId, index) => (
            <div className="esquema-child-connector" key={hijoId}>
              <div className="esquema-child-link" />
              <NodoEsquema
                nodo={nodesById[hijoId]}
                nodesById={nodesById}
                edgesPorPadre={edgesPorPadre}
                nivel={index + 1}
                soloLectura={soloLectura}
                onCambiarTexto={onCambiarTexto}
              />
            </div>
          ))}
        </div>
      )}
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
      <NodoEsquema
        nodo={raiz}
        nodesById={nodesById}
        edgesPorPadre={edgesPorPadre}
        nivel={1}
        soloLectura={soloLectura}
        onCambiarTexto={onCambiarTexto}
        esRaiz
      />
    </div>
  );
}
