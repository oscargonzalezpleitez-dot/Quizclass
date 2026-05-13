import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import QRCode from 'react-qr-code';
import { db } from '../firebase';
import {
  doc, getDoc, updateDoc, onSnapshot, collection,
  query, where, orderBy, serverTimestamp
} from 'firebase/firestore';

const APP_URL = import.meta.env.VITE_APP_URL || window.location.origin;

export default function QRPanel() {
  const { evalId } = useParams();
  const navigate = useNavigate();
  const [evaluacion, setEvaluacion] = useState(null);
  const [ingresos, setIngresos] = useState([]);
  const [expiracion, setExpiracion] = useState(60);
  const [maxEst, setMaxEst] = useState(80);
  const [saving, setSaving] = useState(false);
  const qrRef = useRef(null);

  const qrUrl = evaluacion
    ? `${APP_URL}/exam?token=${evaluacion.qrToken}`
    : '';

  useEffect(() => {
    if (!sessionStorage.getItem('docente_auth')) { navigate('/'); return; }
    const unsub = onSnapshot(doc(db, 'evaluaciones', evalId), snap => {
      if (snap.exists()) setEvaluacion({ id: snap.id, ...snap.data() });
    });
    return () => unsub();
  }, [evalId]);

  useEffect(() => {
    if (!evalId) return;
    const q = query(
      collection(db, 'ingresos'),
      where('evalId', '==', evalId),
      orderBy('timestamp', 'desc')
    );
    const unsub = onSnapshot(q, snap => {
      setIngresos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [evalId]);

  const toggleQR = async () => {
    setSaving(true);
    const nuevoEstado = !evaluacion.qrActivo;
    const updates = { qrActivo: nuevoEstado };
    if (nuevoEstado) {
      const expMs = expiracion * 60 * 1000;
      updates.expiraEn = new Date(Date.now() + expMs);
      updates.maxEstudiantes = maxEst;
      updates.activadoEn = serverTimestamp();
    } else {
      updates.expiraEn = null;
    }
    await updateDoc(doc(db, 'evaluaciones', evalId), updates);
    setSaving(false);
  };

  const regenerarToken = async () => {
    if (!confirm('¿Regenerar QR? El QR anterior quedará inválido.')) return;
    setSaving(true);
    const nuevoToken = crypto.randomUUID() + '-' + Date.now();
    await updateDoc(doc(db, 'evaluaciones', evalId), {
      qrToken: nuevoToken,
      qrActivo: false,
      expiraEn: null,
      estudiantesConectados: 0,
    });
    setSaving(false);
  };

  const descargarQR = () => {
    const svg = qrRef.current?.querySelector('svg');
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 512;
    const ctx = canvas.getContext('2d');
    const img = new Image();
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    img.onload = () => {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 512, 512);
      ctx.drawImage(img, 0, 0, 512, 512);
      const a = document.createElement('a');
      a.download = `QR-${evaluacion.nombre.replace(/\s+/g, '-')}.png`;
      a.href = canvas.toDataURL('image/png');
      a.click();
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  const tiempoRestante = () => {
    if (!evaluacion?.expiraEn) return null;
    const exp = evaluacion.expiraEn.toDate
      ? evaluacion.expiraEn.toDate()
      : new Date(evaluacion.expiraEn);
    const diff = exp - Date.now();
    if (diff <= 0) return 'Expirado';
    const mins = Math.floor(diff / 60000);
    const segs = Math.floor((diff % 60000) / 1000);
    return `${mins}m ${segs}s`;
  };

  if (!evaluacion) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-gray-400 text-lg animate-pulse">Cargando panel QR...</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      <header className="bg-usam-navy text-white px-6 py-4 flex justify-between items-center shadow-lg">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/panel')} className="text-white/70 hover:text-white transition text-xl">←</button>
          <div>
            <h1 className="text-lg font-bold">{evaluacion.nombre}</h1>
            <p className="text-xs text-white/70">Clase: {evaluacion.clase}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => navigate(`/proyector/${evalId}`)}
            className="bg-usam-gold text-usam-navy px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90 transition"
          >
            🖥️ Modo proyector
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* QR Panel */}
        <div className="bg-white rounded-2xl shadow-lg p-6 flex flex-col items-center">
          <div className="flex items-center gap-3 mb-4 self-start w-full justify-between">
            <h2 className="text-lg font-bold text-usam-navy">Código QR</h2>
            <span className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${evaluacion.qrActivo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
              <span className={`w-2 h-2 rounded-full ${evaluacion.qrActivo ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></span>
              {evaluacion.qrActivo ? 'QR ACTIVO' : 'QR INACTIVO'}
            </span>
          </div>

          <div ref={qrRef} className={`p-4 bg-white border-4 rounded-2xl transition-all ${evaluacion.qrActivo ? 'border-green-400 shadow-lg shadow-green-100' : 'border-gray-200 opacity-60'}`}>
            <QRCode value={qrUrl} size={220} />
          </div>

          <p className="text-xs text-gray-400 mt-3 text-center break-all px-2">{qrUrl}</p>

          {evaluacion.qrActivo && tiempoRestante() && (
            <div className="mt-3 bg-orange-50 border border-orange-200 rounded-lg px-4 py-2 text-sm text-orange-700 font-mono font-semibold">
              ⏱️ Expira en: {tiempoRestante()}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 mt-5 w-full">
            <button
              onClick={toggleQR}
              disabled={saving}
              className={`py-3 rounded-xl font-semibold transition text-white ${evaluacion.qrActivo ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'} disabled:opacity-50`}
            >
              {saving ? '...' : evaluacion.qrActivo ? '🔴 Desactivar QR' : '🟢 Activar QR'}
            </button>
            <button
              onClick={regenerarToken}
              disabled={saving}
              className="py-3 rounded-xl font-semibold bg-usam-blue text-white hover:bg-usam-navy transition disabled:opacity-50"
            >
              🔄 Regenerar QR
            </button>
            <button
              onClick={descargarQR}
              className="py-3 rounded-xl font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 transition"
            >
              ⬇️ Descargar PNG
            </button>
            <button
              onClick={() => navigate(`/proyector/${evalId}`)}
              className="py-3 rounded-xl font-semibold bg-usam-gold text-usam-navy hover:opacity-90 transition"
            >
              📽️ Proyectar
            </button>
          </div>
        </div>

        {/* Configuración y Estudiantes */}
        <div className="space-y-4">
          
          {/* Config */}
          <div className="bg-white rounded-2xl shadow-lg p-5">
            <h3 className="font-bold text-usam-navy mb-3">⚙️ Configuración del QR</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-500 font-medium block mb-1">Duración (minutos)</label>
                <input
                  type="number"
                  value={expiracion}
                  onChange={e => setExpiracion(Number(e.target.value))}
                  min={1} max={240}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-usam-blue"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 font-medium block mb-1">Máx. estudiantes</label>
                <input
                  type="number"
                  value={maxEst}
                  onChange={e => setMaxEst(Number(e.target.value))}
                  min={1} max={300}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-usam-blue"
                />
              </div>
            </div>
          </div>

          {/* Contador en vivo */}
          <div className="bg-white rounded-2xl shadow-lg p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-usam-navy">👥 Estudiantes conectados</h3>
              <span className="text-3xl font-bold text-usam-blue">{ingresos.length}</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2 mb-2">
              <div
                className="bg-usam-blue rounded-full h-2 transition-all"
                style={{ width: `${Math.min((ingresos.length / maxEst) * 100, 100)}%` }}
              />
            </div>
            <p className="text-xs text-gray-400">{ingresos.length} de {maxEst} máximo</p>
          </div>

          {/* Lista de ingresos */}
          <div className="bg-white rounded-2xl shadow-lg p-5 max-h-80 overflow-y-auto">
            <h3 className="font-bold text-usam-navy mb-3">📋 Ingresos en tiempo real</h3>
            {ingresos.length === 0 && (
              <p className="text-gray-400 text-sm text-center py-4">Esperando estudiantes...</p>
            )}
            <div className="space-y-2">
              {ingresos.map((ing, i) => (
                <div key={ing.id} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                  <span className="text-xs font-mono text-gray-400 w-5">{i + 1}</span>
                  {ing.selfiePath && (
                    <img src={ing.selfiePath} className="w-8 h-8 rounded-full object-cover" alt="" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{ing.nombre}</p>
                    <p className="text-xs text-gray-400 truncate">{ing.carnet} · {ing.correo}</p>
                  </div>
                  <span className="text-xs bg-usam-blue/10 text-usam-blue px-2 py-0.5 rounded-full">
                    Var. {ing.variante || '?'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
