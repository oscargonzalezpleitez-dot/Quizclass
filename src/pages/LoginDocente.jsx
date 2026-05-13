import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const DOCENTE_PASS = import.meta.env.VITE_DOCENTE_PASS || 'profesor2024';

export default function LoginDocente() {
  const [pass, setPass] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    await new Promise(r => setTimeout(r, 500));
    if (pass === DOCENTE_PASS) {
      sessionStorage.setItem('docente_auth', '1');
      navigate('/panel');
    } else {
      setError('Contraseña incorrecta');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-usam-navy via-usam-blue to-usam-surf flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-usam-navy rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">🎓</span>
          </div>
          <h1 className="text-2xl font-bold text-usam-navy">QuizClass USAM Pro</h1>
          <p className="text-gray-500 mt-1">Panel Docente</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Contraseña del docente
            </label>
            <input
              type="password"
              value={pass}
              onChange={e => setPass(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-usam-blue"
              placeholder="••••••••"
              required
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 rounded-lg px-4 py-3 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-usam-navy text-white py-3 rounded-lg font-semibold hover:bg-usam-blue transition-colors disabled:opacity-50"
          >
            {loading ? 'Verificando...' : 'Ingresar al panel'}
          </button>
        </form>
      </div>
    </div>
  );
              }
