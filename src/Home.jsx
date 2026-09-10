import { useState, useEffect } from 'react';
import { nanoid } from 'nanoid';
import { supabase } from './supabaseClient';
import './styles.css';

export default function Home() {
  const [mapas, setMapas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [nombreNuevo, setNombreNuevo] = useState('');
  const [carpetaNueva, setCarpetaNueva] = useState('');
  const [creando, setCreando] = useState(false);

  useEffect(() => {
    cargarMapas();
  }, []);

  async function cargarMapas() {
    setCargando(true);
    const { data, error } = await supabase
      .from('mapas')
      .select('*')
      .order('creado_en', { ascending: false });

    if (error) {
      console.error('Error cargando mapas:', error);
    } else {
      setMapas(data || []);
    }
    setCargando(false);
  }

  async function crearMapa(e) {
    e.preventDefault();
    if (!nombreNuevo.trim()) return;
    setCreando(true);

    const nuevoId = nanoid(10);
    const carpetaFinal = carpetaNueva.trim() || 'Sin carpeta';

    const { error } = await supabase.from('mapas').insert({
      id: nuevoId,
      nombre: nombreNuevo.trim(),
      carpeta: carpetaFinal,
    });

    setCreando(false);

    if (error) {
      alert('No se pudo crear el mapa. Intenta de nuevo.');
      console.error(error);
      return;
    }

    window.location.href = `${window.location.pathname}?mapa=${nuevoId}`;
  }

  async function eliminarMapa(id) {
    if (!confirm('¿Eliminar este mapa y todos sus nodos? Esta acción no se puede deshacer.')) return;
    await supabase.from('nodos').delete().eq('mapa_id', id);
    await supabase.from('mapas').delete().eq('id', id);
    cargarMapas();
  }

  function abrirMapa(id) {
    window.location.href = `${window.location.pathname}?mapa=${id}`;
  }

  // Agrupar mapas por carpeta
  const carpetas = {};
  mapas.forEach((m) => {
    const nombreCarpeta = m.carpeta || 'Sin carpeta';
    if (!carpetas[nombreCarpeta]) carpetas[nombreCarpeta] = [];
    carpetas[nombreCarpeta].push(m);
  });

  const carpetasExistentes = Object.keys(carpetas).sort();

  return (
    <div className="home-contenedor">
      <header className="app-header">
        <h1>Mis Mapas Mentales</h1>
      </header>

      <div className="home-contenido">
        <form className="home-form-nuevo" onSubmit={crearMapa}>
          <input
            type="text"
            placeholder="Nombre del nuevo mapa"
            value={nombreNuevo}
            onChange={(e) => setNombreNuevo(e.target.value)}
            className="home-input"
          />
          <input
            type="text"
            placeholder="Carpeta (ej: Trabajo, Proyecto X)"
            value={carpetaNueva}
            onChange={(e) => setCarpetaNueva(e.target.value)}
            list="lista-carpetas"
            className="home-input"
          />
          <datalist id="lista-carpetas">
            {carpetasExistentes.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          <button type="submit" className="boton-compartir" disabled={creando}>
            {creando ? 'Creando…' : '+ Crear mapa'}
          </button>
        </form>

        {cargando ? (
          <p className="home-vacio">Cargando tus mapas…</p>
        ) : mapas.length === 0 ? (
          <p className="home-vacio">Todavía no tienes mapas. Crea el primero arriba.</p>
        ) : (
          carpetasExistentes.map((nombreCarpeta) => (
            <div key={nombreCarpeta} className="home-carpeta">
              <h2 className="home-carpeta-titulo">📁 {nombreCarpeta}</h2>
              <div className="home-lista-mapas">
                {carpetas[nombreCarpeta].map((mapa) => (
                  <div key={mapa.id} className="home-tarjeta-mapa" onClick={() => abrirMapa(mapa.id)}>
                    <span className="home-tarjeta-nombre">{mapa.nombre}</span>
                    <button
                      className="home-tarjeta-eliminar"
                      title="Eliminar mapa"
                      onClick={(e) => {
                        e.stopPropagation();
                        eliminarMapa(mapa.id);
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
