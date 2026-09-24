import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import AuthPage from './pages/AuthPage';
import MainLayout from './components/layout/MainLayout';
import Dashboard from './pages/Dashboard';
import EventSettings from './pages/EventSettings';
import Sales from './pages/Sales';
import Gate from './pages/Gate';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<AuthPage key="login" mode="login" />} />
          <Route path="/registro" element={<AuthPage key="register" mode="register" />} />
          <Route path="/recuperar" element={<AuthPage key="recovery" mode="recovery" />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<MainLayout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/evento" element={<EventSettings />} />
              <Route path="/ventas" element={<Sales />} />
              <Route path="/puerta" element={<Gate />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
