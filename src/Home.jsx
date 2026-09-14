import { useState, useEffect } from 'react';
import { nanoid } from 'nanoid';
import { supabase } from './supabaseClient';
import './styles.css';

// Este componente sirve como pantalla inicial para listar, crear y eliminar mapas mentales.
// Se encarga de cargar los proyectos desde Supabase y redirigir al editor de cada mapa.
export default function Home() {
  // mapas: almacena la lista de mapas recuperados desde la base de datos.
  const [mapas, setMapas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [nombreNuevo, setNombreNuevo] = useState('');
  const [carpetaNueva, setCarpetaNueva] = useState('');
  const [creando, setCreando] = useState(false);

  // Este efecto ejecuta la carga inicial de mapas cuando se monta la pantalla de inicio.
  useEffect(() => {
    cargarMapas();
  }, []);

  // Carga todos los mapas del usuario ordenados por fecha de creación para mostrarlos agrupados por carpeta.
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

  // Crea un nuevo mapa con un nombre y una carpeta opcional, y redirige al editor del mapa recién creado.
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

  // Elimina un mapa y todos sus nodos asociados tras confirmar la acción en el navegador.
  async function eliminarMapa(id) {
    if (!confirm('¿Eliminar este mapa y todos sus nodos? Esta acción no se puede deshacer.')) return;
    await supabase.from('nodos').delete().eq('mapa_id', id);
    await supabase.from('mapas').delete().eq('id', id);
    cargarMapas();
  }

  // Navega al editor del mapa indicado usando el identificador del mapa en la URL.
  function abrirMapa(id) {
    window.location.href = `${window.location.pathname}?mapa=${id}`;
  }

  // Agrupa los mapas por carpeta para mostrar la pantalla de inicio ordenada y fácil de navegar.
  const carpetas = {};
  mapas.forEach((m) => {
    const nombreCarpeta = m.carpeta || 'Sin carpeta';
    if (!carpetas[nombreCarpeta]) carpetas[nombreCarpeta] = [];
    carpetas[nombreCarpeta].push(m);
  });

  const carpetasExistentes = Object.keys(carpetas).sort();

  // Render principal de la pantalla de inicio: cabecera general, formulario de creación y listado agrupado por carpetas.
  return (
    <div className="home-contenedor">
      <header className="app-header">
        <h1>Mis Mapas Mentales</h1>
      </header>

      <div className="home-contenido">
        {/* Formulario para crear un mapa nuevo con nombre y carpeta opcional. */}
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
