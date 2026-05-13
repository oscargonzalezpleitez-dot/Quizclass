import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

// Banco de preguntas de ejemplo (reemplaza con tus preguntas reales)
const BANCO_PREGUNTAS = {
  A: [
    { id: 1, pregunta: '¿Cuál es el hueso más largo del cuerpo de un perro?', opciones: ['Fémur', 'Tibia', 'Húmero', 'Radio'], correcta: 0 },
    { id: 2, pregunta: '¿Cuántas cámaras tiene el corazón de un bovino?', opciones: ['2', '3', '4', '6'], correcta: 2 },
    { id: 3, pregunta: '¿Qué órgano filtra la sangre en los mamíferos?', opciones: ['Hígado', 'Riñón', 'Bazo', 'Páncreas'], correcta: 1 },
  ],
  B: [
    { id: 1, pregunta: '¿Cuántas cámaras tiene el corazón de un bovino?', opciones: ['2', '3', '4', '6'], correcta: 2 },
    { id: 2, pregunta: '¿Cuál es el hueso más largo del cuerpo de un perro?', opciones: ['Tibia', 'Fémur', 'Radio', 'Húmero'], correcta: 1 },
    { id: 3, pregunta: '¿Cuál es la función principal del hígado?', opciones: ['Filtrar orina', 'Producir bilis y metabolizar', 'Producir insulina', 'Producir glóbulos rojos'], correcta: 1 },
  ],
  C: [
    { id: 1, pregunta: '¿Qué órgano filtra la sangre en los mamíferos?', opciones: ['Hígado', 'Bazo', 'Riñón', 'Páncreas'], correcta: 2 },
    { id: 2, pregunta: '¿Cuántas vértebras cervicales tiene la mayoría de los mamíferos?', opciones: ['5', '6', '7', '8'], correcta: 2 },
    { id: 3, pregunta: '¿Cuál es el hueso más largo del cuerpo de un perro?', opciones: ['Húmero', 'Radio', 'Fémur', 'Tibia'], correcta: 2 },
  ],
  D: [
    { id: 1, pregunta: '¿Cuántas vértebras cervicales tiene la mayoría de los mamíferos?', opciones: ['5', '6', '7', '8'], correcta: 2 },
    { id: 2, pregunta: '¿Qué órgano filtra la sangre en los mamíferos?', opciones: ['Bazo', 'Riñón', 'Hígado', 'Páncreas'], correcta: 1 },
    { id: 3, pregunta: '¿Cuántas cámaras tiene el corazón de un bovino?', opciones: ['6', '4', '3', '2'], correcta: 1 },
  ],
};

export default function Cuestionario() {
  const { ingresoId } = useParams();
  const navigate = useNavigate();
  const [ingreso, setIngreso] = useState(null);
  const [preguntas, setPreguntas] = useState([]);
  const [respuestas, setRespuestas] = useState({});
  const [enviado, setEnviado] = useState(false);
  const [puntaje, setPuntaje] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    cargarIngreso();
  }, [ingresoId]);

  const cargarIngreso = async () => {
    const snap = await getDoc(doc(db, 'ingresos', ingresoId));
    if (!snap.exists()) { navigate('/'); return; }
    const data = { id: snap.id, ...snap.data() };
    setIngreso(data);
    const variante = data.variante || 'A';
    setPreguntas(BANCO_PREGUNTAS[variante] || BANCO_PREGUNTAS.A);
    if (data.enviado) {
      setEnviado(true);
      setPuntaje(data.puntaje || 0);
    }
    setLoading(false);
  };

  const seleccionar = (pregId, opIdx) => {
    if (enviado) return;
    setRespuestas(r => ({ ...r, [pregId]: opIdx }));
  };

  const handleSubmit = async () => {
    if (Object.keys(respuestas).length < preguntas.length) {
      alert('Debes responder todas las preguntas antes de enviar.');
      return;
    }
    if (!confirm('¿Estás seguro de enviar el examen? No podrás cambiar tus respuestas.')) return;
    
    let correctas = 0;
    preguntas.forEach(p => {
      if (respuestas[p.id] === p.correcta) correctas++;
    });
    const pts = Math.round((correctas / preguntas.length) * 100);
    
    await updateDoc(doc(db, 'ingresos', ingresoId), {
      respuestas,
      puntaje: pts,
      correctas,
      enviado: true,
      enviadoEn: new Date(),
    });

    setPuntaje(pts);
    setEnviado(true);
  };

  if (loading) return (
    <div className="min-h-screen bg-gradient-to-br from-usam-navy to-usam-blue flex items-center justify-center">
      <div className="text-white text-xl animate-pulse">Cargando examen...</div>
    </div>
  );

  if (enviado) return (
    <div className="min-h-screen bg-gradient-to-br from-usam-navy to-usam-blue flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md text-center">
        <div className="text-6xl mb-4">{puntaje >= 60 ? '🎉' : '📚'}</div>
        <h1 className="text-2xl font-bold text-usam-navy">Examen enviado</h1>
        <p className="text-gray-500 mt-2">Hola, {ingreso?.nombre}</p>
        <div className="my-6">
          <div className={`text-6xl font-bold ${puntaje >= 60 ? 'text-green-500' : 'text-red-500'}`}>{puntaje}%</div>
          <p className="text-gray-400 text-sm mt-1">Variante {ingreso?.variante}</p>
        </div>
        <p className="text-gray-600">{puntaje >= 60 ? '¡Bien hecho! Aprobaste el examen.' : 'No aprobaste. ¡Sigue estudiando!'}</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-usam-navy text-white px-6 py-4 sticky top-0 z-10 shadow">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="font-bold">Examen — Variante {ingreso?.variante}</h1>
            <p className="text-xs text-white/70">{ingreso?.nombre} · {ingreso?.carnet}</p>
          </div>
          <span className="text-sm bg-white/10 px-3 py-1 rounded-full">
            {Object.keys(respuestas).length}/{preguntas.length} respondidas
          </span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-6 space-y-6">
        {preguntas.map((p, idx) => (
          <div key={p.id} className="bg-white rounded-2xl shadow p-6">
            <p className="font-semibold text-gray-800 mb-4">
              <span className="text-usam-blue font-bold mr-2">{idx + 1}.</span>
              {p.pregunta}
            </p>
            <div className="space-y-2">
              {p.opciones.map((op, i) => (
                <button
                  key={i}
                  onClick={() => seleccionar(p.id, i)}
                  className={`w-full text-left px-4 py-3 rounded-xl border-2 transition font-medium ${
                    respuestas[p.id] === i
                      ? 'border-usam-blue bg-usam-blue/10 text-usam-blue'
                      : 'border-gray-200 hover:border-usam-blue/40 text-gray-700'
                  }`}
                >
                  <span className="font-mono text-sm mr-2 text-gray-400">{String.fromCharCode(65 + i)})</span>
                  {op}
                </button>
              ))}
            </div>
          </div>
        ))}

        <button
          onClick={handleSubmit}
          className="w-full bg-usam-navy text-white py-4 rounded-2xl font-bold text-lg hover:bg-usam-blue transition shadow-lg"
        >
          ✅ Enviar examen
        </button>
      </main>
    </div>
  );
}
