import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { collection, addDoc, getDocs, deleteDoc, doc, serverTimestamp, query, orderBy } from 'firebase/firestore';

export default function PanelDocente() {
  const [evaluaciones, setEvaluaciones] = useState([]);
  const [nombre, setNombre] = useState('');
  const [clase, setClase] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!sessionStorage.getItem('docente_auth')) navigate('/');
    cargarEvaluaciones();
  }, []);

  const cargarEvaluaciones = async () => {
    const q = query(collection(db, 'evaluaciones'), orderBy('creadoEn', 'desc'));
    const snap = await getDocs(q);
    setEvaluaciones(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  const crearEvaluacion = async (e) => {
    e.preventDefault();
    if (!nombre.trim() || !clase.trim()) return;
    setLoading(true);
    const token = crypto.randomUUID() + '-' + Date.now();
    await addDoc(collection(db, 'evaluaciones'), {
      nombre: nombre.trim(),
      clase: clase.trim(),
      qrToken: token,
      qrActivo: false,
      estudiantesConectados: 0,
      creadoEn: serverTimestamp(),
      expiraEn: null,
      maxEstudiantes: 80,
    });
    setNombre('');
    setClase('');
    setLoading(false);
    cargarEvaluaciones();
  };

  const eliminar = async (id) => {
    if (!confirm('¿Eliminar esta evaluación?')) return;
    await deleteDoc(doc(db, 'evaluaciones', id));
    cargarEvaluaciones();
  };

  const cerrarSesion = () => {
    sessionStorage.removeItem('docente_auth');
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-usam-navy text-white px-6 py-4 flex justify-between items-center shadow">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🎓</span>
          <h1 className="text-xl font-bold">Panel Docente — QuizClass USAM</h1>
        </div>
        <button onClick={cerrarSesion} className="text-sm bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg transition">
          Cerrar sesión
        </button>
      </header>

      <main className="max-w-4xl mx-auto p-6 space-y-8">
        <section className="bg-white rounded-2xl shadow p-6">
          <h2 className="text-lg font-bold text-usam-navy mb-4">➕ Nueva evaluación</h2>
          <form onSubmit={crearEvaluacion} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              placeholder="Nombre del examen"
              className="border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-usam-blue"
              required
            />
            <input
              value={clase}
              onChange={e => setClase(e.target.value)}
              placeholder="Código de clase (ej: VET-2026)"
              className="border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-usam-blue"
              required
            />
            <button
              type="submit"
              disabled={loading}
              className="sm:col-span-2 bg-usam-navy text-white py-2 rounded-lg font-semibold hover:bg-usam-blue transition disabled:opacity-50"
            >
              {loading ? 'Creando...' : 'Crear evaluación con QR'}
            </button>
          </form>
        </section>

        <section className="bg-white rounded-2xl shadow p-6">
          <h2 className="text-lg font-bold text-usam-navy mb-4">📋 Mis evaluaciones</h2>
          {evaluaciones.length === 0 && (
            <p className="text-gray-400 text-center py-8">No hay evaluaciones aún. Crea una arriba.</p>
          )}
          <div className="space-y-3">
            {evaluaciones.map(ev => (
              <div key={ev.id} className="border border-gray-200 rounded-xl p-4 flex items-center justify-between gap-4">
                <div>
                  <p className="font-semibold text-gray-800">{ev.nombre}</p>
                  <p className="text-sm text-gray-500">Clase: {ev.clase}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ev.qrActivo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {ev.qrActivo ? '🟢 QR Activo' : '⚪ QR Inactivo'}
                    </span>
                    <span className="text-xs text-gray-400">
                      {ev.estudiantesConectados || 0} estudiantes
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => navigate(`/panel/qr/${ev.id}`)}
                    className="bg-usam-blue text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-usam-navy transition"
                  >
                    Gestionar QR
                  </button>
                  <button
                    onClick={() => eliminar(ev.id)}
                    className="bg-red-50 text-red-500 px-3 py-2 rounded-lg text-sm hover:bg-red-100 transition"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
