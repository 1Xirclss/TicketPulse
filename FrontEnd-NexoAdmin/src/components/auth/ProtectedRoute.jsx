import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

export default function ProtectedRoute() {
  const { user, loading, error, refresh } = useAuth();
  if (loading) return <main className="status-page" role="status"><span className="spinner"/> Verificando sesión…</main>;
  if (error) return <main className="status-page"><p role="alert">{error}</p><button onClick={refresh}>Reintentar conexión</button></main>;
  return user ? <Outlet/> : <Navigate to="/login" replace/>;
}
