import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Webcam from 'react-webcam';
import { db, storage } from '../firebase';
import {
  doc, getDoc, addDoc, updateDoc, collection,
  increment, serverTimestamp, getDocs, query, where
} from 'firebase/firestore';
import { ref as storageRef, uploadString, getDownloadURL } from 'firebase/storage';

function getDeviceFingerprint() {
  const { userAgent, language, hardwareConcurrency, platform } = navigator;
  const { width, height, colorDepth } = screen;
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const raw = `${userAgent}|${language}|${hardwareConcurrency}|${platform}|${width}x${height}|${colorDepth}|${tz}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = ((hash << 5) - hash) + raw.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(16);
}

const VARIANTES = ['A', 'B', 'C', 'D'];

export default function RegistroQR() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const webcamRef = useRef(null);
  const token = params.get('token');

  const [evaluacion, setEvaluacion] = useState(null);
  const [error, setError] = useState('');
  const [paso, setPaso] = useState('validando'); // validando | formulario | selfie | procesando | listo | expirado | invalido
  const [nombre, setNombre] = useState('');
  const [carnet, setCarnet] = useState('');
  const [correo, setCorreo] = useState('');
  const [selfie, setSelfie] = useState(null);
  const [showCam, setShowCam] = useState(false);

  useEffect(() => {
    if (!token) { setPaso('invalido'); return; }
    validarToken();
  }, [token]);

  const validarToken = async () => {
    setPaso('validando');
    const q = query(collection(db, 'evaluaciones'), where('qrToken', '==', token));
    const snap = await getDocs(q);
    if (snap.empty) { setPaso('invalido'); return; }

    const ev = { id: snap.docs[0].id, ...snap.docs[0].data() };
    setEvaluacion(ev);

    if (!ev.qrActivo) { setPaso('invalido'); setError('El QR no está activo. Espera que el docente lo active.'); return; }

    if (ev.expiraEn) {
      const exp = ev.expiraEn.toDate ? ev.expiraEn.toDate() : new Date(ev.expiraEn);
      if (Date.now() > exp) { setPaso('expirado'); return; }
    }

    // Verificar duplicado por dispositivo
    const fp = getDeviceFingerprint();
    const dupQ = query(collection(db, 'ingresos'),
      where('evalId', '==', ev.id),
      where('deviceFingerprint', '==', fp)
    );
    const dupSnap = await getDocs(dupQ);
    if (!dupSnap.empty) {
      const ingreso = { id: dupSnap.docs[0].id, ...dupSnap.docs[0].data() };
      navigate(`/cuestionario/${ingreso.id}`);
      return;
    }

    if (ev.estudiantesConectados >= ev.maxEstudiantes) {
      setError('Se alcanzó el límite máximo de estudiantes.');
      setPaso('invalido');
      return;
    }

    setPaso('formulario');
  };

  const capturarSelfie = () => {
    const img = webcamRef.current?.getScreenshot();
    if (img) { setSelfie(img); setShowCam(false); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selfie) { setError('La selfie es obligatoria.'); return; }
    setPaso('procesando');
    setError('');

    try {
      const fp = getDeviceFingerprint();
      // Asignar variante balanceada
      const ingSnap = await getDocs(query(collection(db, 'ingresos'), where('evalId', '==', evaluacion.id)));
      const variante = VARIANTES[ingSnap.size % VARIANTES.length];

      // Subir selfie a Firebase Storage
      let selfiePath = '';
      try {
        const selfieRef = storageRef(storage, `selfies/${evaluacion.id}/${fp}-${Date.now()}.jpg`);
        await uploadString(selfieRef, selfie, 'data_url');
        selfiePath = await getDownloadURL(selfieRef);
      } catch {}

      // Crear ingreso
      const ingresoRef = await addDoc(collection(db, 'ingresos'), {
        evalId: evaluacion.id,
        nombre: nombre.trim(),
        carnet: carnet.trim(),
        correo: correo.trim().toLowerCase(),
        variante,
        selfiePath,
        deviceFingerprint: fp,
        timestamp: serverTimestamp(),
      });

      // Actualizar contador
      await updateDoc(doc(db, 'evaluaciones', evaluacion.id), {
        estudiantesConectados: increment(1),
      });

      navigate(`/cuestionario/${ingresoRef.id}`);
    } catch (err) {
      setError('Error al registrarse: ' + err.message);
      setPaso('formulario');
    }
  };

  if (paso === 'validando') return (
    <div className="min-h-screen bg-gradient-to-br from-usam-navy to-usam-blue flex items-center justify-center">
      <div className="text-white text-center">
        <div className="text-4xl animate-spin mb-4">⚙️</div>
        <p className="text-lg font-medium">Validando acceso...</p>
      </div>
    </div>
  );

  if (paso === 'expirado') return (
    <div className="min-h-screen bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md text-center">
        <div className="text-6xl mb-4">⏰</div>
        <h1 className="text-2xl font-bold text-gray-800">QR Expirado</h1>
        <p className="text-gray-500 mt-2">Este código QR ya no es válido. El examen ha finalizado.</p>
      </div>
    </div>
  );

  if (paso === 'invalido') return (
    <div className="min-h-screen bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md text-center">
        <div className="text-6xl mb-4">🚫</div>
        <h1 className="text-2xl font-bold text-gray-800">Acceso no válido</h1>
        <p className="text-gray-500 mt-2">{error || 'Este QR no es válido o ha sido desactivado.'}</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-usam-navy via-usam-blue to-usam-surf flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        
        <div className="bg-usam-navy px-6 py-5 text-white text-center">
          <p className="text-xs text-white/60 uppercase tracking-wider mb-1">USAM — Plataforma de Evaluaciones</p>
          <h1 className="text-xl font-bold">{evaluacion?.nombre}</h1>
          <p className="text-sm text-white/70 mt-1">Clase: {evaluacion?.clase}</p>
        </div>

        <div className="p-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 rounded-lg px-4 py-3 text-sm mb-4">
              {error}
            </div>
          )}

          {paso === 'procesando' ? (
            <div className="text-center py-8">
              <div className="text-4xl animate-spin mb-4">⚙️</div>
              <p className="text-gray-600">Procesando registro...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre completo *</label>
                <input
                  value={nombre}
                  onChange={e => setNombre(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-usam-blue"
                  placeholder="Tu nombre completo"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Carnet *</label>
                <input
                  value={carnet}
                  onChange={e => setCarnet(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-usam-blue"
                  placeholder="Ej: VET-2024-001"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Correo institucional *</label>
                <input
                  type="email"
                  value={correo}
                  onChange={e => setCorreo(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-usam-blue"
                  placeholder="estudiante@usam.edu.sv"
                  required
                />
              </div>

              {/* Selfie */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Selfie obligatoria *</label>
                {selfie ? (
                  <div className="relative">
                    <img src={selfie} className="w-full h-40 object-cover rounded-xl" alt="Selfie" />
                    <button
                      type="button"
                      onClick={() => { setSelfie(null); setShowCam(true); }}
                      className="absolute top-2 right-2 bg-black/60 text-white text-xs px-3 py-1 rounded-full"
                    >
                      Retomar
                    </button>
                  </div>
                ) : showCam ? (
                  <div className="rounded-xl overflow-hidden">
                    <Webcam
                      ref={webcamRef}
                      screenshotFormat="image/jpeg"
                      className="w-full rounded-xl"
                      videoConstraints={{ facingMode: 'user' }}
                    />
                    <button
                      type="button"
                      onClick={capturarSelfie}
                      className="w-full bg-usam-blue text-white py-3 font-semibold hover:bg-usam-navy transition mt-2 rounded-xl"
                    >
                      📸 Capturar selfie
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowCam(true)}
                    className="w-full border-2 border-dashed border-gray-300 rounded-xl py-6 text-gray-400 hover:border-usam-blue hover:text-usam-blue transition"
                  >
                    📷 Abrir cámara para selfie
                  </button>
                )}
              </div>

              <button
                type="submit"
                disabled={paso === 'procesando'}
                className="w-full bg-usam-navy text-white py-4 rounded-xl font-bold text-lg hover:bg-usam-blue transition disabled:opacity-50"
              >
                🚀 Ingresar al examen
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
