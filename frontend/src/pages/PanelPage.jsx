import { Navigate, useParams } from 'react-router-dom';
import AdminPage from './AdminPage.jsx';
import OperationalPage from './OperationalPage.jsx';
import PsychologistPage from './PsychologistPage.jsx';

export default function PanelPage() {
  const { role } = useParams();
  if (role === 'admin') return <AdminPage />;
  if (role === 'coordenacao' || role === 'instrutor') return <OperationalPage profile={role} />;
  if (role === 'psicologo') return <PsychologistPage />;
  return <Navigate to="/" replace />;
}
