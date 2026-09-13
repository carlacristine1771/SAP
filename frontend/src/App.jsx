import { Navigate, Route, Routes } from 'react-router-dom';
import LandingPage from './pages/LandingPage.jsx';
import PanelPage from './pages/PanelPage.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/index.html" element={<LandingPage />} />
      <Route path="/painel/:role" element={<PanelPage />} />
      <Route path="/pages/painel-admin.html" element={<Navigate to="/painel/admin" replace />} />
      <Route path="/pages/painel-psicologo.html" element={<Navigate to="/painel/psicologo" replace />} />
      <Route path="/pages/painel-coordenacao.html" element={<Navigate to="/painel/coordenacao" replace />} />
      <Route path="/pages/painel-instrutor.html" element={<Navigate to="/painel/instrutor" replace />} />
      <Route path="/pages/login-admin.html" element={<Navigate to="/?perfil=administrador" replace />} />
      <Route path="/pages/login-psicologo.html" element={<Navigate to="/?perfil=psicologa" replace />} />
      <Route path="/pages/login-coordenacao.html" element={<Navigate to="/?perfil=coordenacao" replace />} />
      <Route path="/pages/login-instrutor.html" element={<Navigate to="/?perfil=instrutor" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
