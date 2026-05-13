import { Routes, Route, Navigate } from 'react-router-dom';
import LoginDocente from './pages/LoginDocente';
import PanelDocente from './pages/PanelDocente';
import QRPanel from './pages/QRPanel';
import RegistroQR from './pages/RegistroQR';
import Cuestionario from './pages/Cuestionario';
import ModoProyector from './pages/ModoProyector';

function App() {
  return (
    <Routes>
      <Route path="/" element={<LoginDocente />} />
      <Route path="/panel" element={<PanelDocente />} />
      <Route path="/panel/qr/:evalId" element={<QRPanel />} />
      <Route path="/proyector/:evalId" element={<ModoProyector />} />
      <Route path="/exam" element={<RegistroQR />} />
      <Route path="/cuestionario/:ingresoId" element={<Cuestionario />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
