import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import QRCode from 'react-qr-code';
import { db } from '../firebase';
import { doc, onSnapshot, collection, query, where } from 'firebase/firestore';

const APP_URL = import.meta.env.VITE_APP_URL || window.location.origin;

export default function ModoProyector() {
  const { evalId } = useParams();
  const navigate = useNavigate();
  const [evaluacion, setEvaluacion] = useState(null);
  const [ingresos, setIngresos] = useState([]);
  const [tick, setTick] = useState(0);

  const qrUrl = evaluacion ? `${APP_URL}/exam?token=${evaluacion.qrToken}` : '';

  useEffect(() => {
    if (!sessionStorage.getItem('docente_auth')) { navigate('/'); return; }
    const unsub = onSnapshot(doc(db, 'evaluaciones', evalId), snap => {
      if (snap.exists()) setEvaluacion({ id: snap.id, ...snap.data() });
    });
    return () => unsub();
  }, [evalId]);

  useEffect(() => {
    if (!evalId) return;
    const q = query(collection(db, 'ingresos'), where('evalId', '==', evalId));
    const unsub = onSnapshot(q, snap => setIngresos(snap.docs));
    return () => unsub();
  }, [evalId]);

  // Reloj para countdown
  useEffect(() => {
    const t = setInterval(() => setTick(x => x + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const tiempoRestante = () => {
    if (!evaluacion?.expiraEn) return null;
    const exp = evaluacion.expiraEn.toDate
      ? evaluacion.expiraEn.toDate()
      : new Date(evaluacion.expiraEn);
    const diff = exp - Date.now();
    if (diff <= 0) return '00:00';
    const mins = String(Math.floor(diff / 60000)).padStart(2, '0');
    const segs = String(Math.floor((diff % 60000) / 1000)).padStart(2, '0');
    return `${mins}:${segs}`;
  };

  const handleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  if (!evaluacion) return (
    <div className="min-h-screen bg-usam-navy flex items-center justify-center">
      <div className="text-white text-2xl animate-pulse">Cargando...</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-usam-navy via-usam-blue to-slate-900 flex flex-col items-center justify-center p-8 relative overflow-hidden">
      
      {/* Fondo animado */}
      <div className="absolute inset-0 opacity-10">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-white"
            style={{
              width: `${80 + i * 60}px`,
              height: `${80 + i * 60}px`,
              top: `${10 + i * 12}%`,
              left: `${5 + i * 15}%`,
              animation: `pulse ${2 + i}s infinite`,
              opacity: 0.05,
            }}
          />
        ))}
      </div>

      {/* Header */}
      <div className="text-center mb-8 z-10">
        <div className="text-white/60 text-sm uppercase tracking-widest mb-2">USAM — Plataforma de Evaluaciones</div>
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-2">{evaluacion.nombre}</h1>
        <p className="text-white/70 text-lg">Clase: {evaluacion.clase}</p>
      </div>

      {/* QR */}
      <div className="z-10 flex flex-col md:flex-row items-center gap-12">
        <div className="flex flex-col items-center">
          <div className={`p-6 bg-white rounded-3xl shadow-2xl ${evaluacion.qrActivo ? 'ring-4 ring-green-400 shadow-green-400/30' : 'opacity-50'}`}>
            {evaluacion.qrActivo ? (
              <QRCode value={qrUrl} size={280} />
            ) : (
              <div className="w-70 h-70 flex items-center justify-center bg-gray-100 rounded-2xl w-64 h-64">
                <div className="text-center text-gray-400">
                  <div className="text-4xl mb-2">⏸️</div>
                  <p className="text-sm">QR Inactivo</p>
                </div>
              </div>
            )}
          </div>

          {/* Estado */}
          <div className={`mt-4 flex items-center gap-3 px-5 py-2.5 rounded-full font-bold text-sm ${evaluacion.qrActivo ? 'bg-green-500/20 text-green-300 border border-green-500/30' : 'bg-white/10 text-white/50 border border-white/20'}`}>
            <span className={`w-3 h-3 rounded-full ${evaluacion.qrActivo ? 'bg-green-400 animate-pulse' : 'bg-gray-400'}`}></span>
            {evaluacion.qrActivo ? '🟢 QR ACTIVO — Escanea ahora' : '⚪ QR INACTIVO'}
          </div>
        </div>

        {/* Panel derecho */}
        <div className="flex flex-col gap-4 min-w-64">
          
          {/* Contador */}
          <div className="bg-white/10 backdrop-blur border border-white/20 rounded-2xl p-6 text-center">
            <p className="text-white/60 text-sm uppercase tracking-wider mb-1">Estudiantes conectados</p>
            <p className="text-6xl font-bold text-white">{ingresos.length}</p>
            <p className="text-white/40 text-xs mt-1">de {evaluacion.maxEstudiantes} máximo</p>
            <div className="w-full bg-white/10 rounded-full h-1.5 mt-3">
              <div
                className="bg-green-400 rounded-full h-1.5 transition-all duration-500"
                style={{ width: `${Math.min((ingresos.length / evaluacion.maxEstudiantes) * 100, 100)}%` }}
              />
            </div>
          </div>

          {/* Temporizador */}
          {evaluacion.qrActivo && tiempoRestante() && (
            <div className="bg-orange-500/20 border border-orange-500/30 rounded-2xl p-5 text-center">
              <p className="text-orange-300 text-xs uppercase tracking-wider mb-1">Tiempo restante</p>
              <p className="text-4xl font-mono font-bold text-orange-300">{tiempoRestante()}</p>
            </div>
          )}

          {/* Instrucciones */}
          <div className="bg-white/10 border border-white/20 rounded-2xl p-5">
            <p className="text-white/80 text-sm font-semibold mb-2">📱 Cómo ingresar:</p>
            <ol className="text-white/60 text-sm space-y-1 list-decimal list-inside">
              <li>Escanea el código QR</li>
              <li>Completa tu registro</li>
              <li>Toma tu selfie</li>
              <li>¡Inicia el examen!</li>
            </ol>
          </div>
        </div>
      </div>

      {/* Botones flotantes */}
      <div className="fixed bottom-6 right-6 flex gap-3 z-20">
        <button
          onClick={handleFullscreen}
          className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-xl text-sm backdrop-blur transition"
        >
          ⛶ Pantalla completa
        </button>
        <button
          onClick={() => navigate(`/panel/qr/${evalId}`)}
          className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-xl text-sm backdrop-blur transition"
        >
          ← Panel
        </button>
      </div>
    </div>
  );
    }
