import { lazy, Suspense } from "react";
import { Navigate, useParams } from "react-router-dom";
import { LoadingScreen } from "../components/ui/Feedback.tsx";

const AdminPage = lazy(() => import("./AdminPage.jsx"));
const OperationalPage = lazy(() => import("./OperationalPage.jsx"));
const PsychologistPage = lazy(() => import("./PsychologistPage.jsx"));

export default function PanelPage() {
  const { role } = useParams();
  if (role === "admin")
    return (
      <Suspense fallback={<LoadingScreen />}>
        <AdminPage />
      </Suspense>
    );
  if (role === "coordenacao" || role === "instrutor")
    return (
      <Suspense fallback={<LoadingScreen />}>
        <OperationalPage profile={role} />
      </Suspense>
    );
  if (role === "psicologo")
    return (
      <Suspense fallback={<LoadingScreen />}>
        <PsychologistPage />
      </Suspense>
    );
  return <Navigate to="/" replace />;
}
