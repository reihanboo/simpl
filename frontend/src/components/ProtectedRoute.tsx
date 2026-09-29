import { Navigate, Outlet, useLocation } from 'react-router-dom';

export function ProtectedRoute() {
  const token = localStorage.getItem('token') || sessionStorage.getItem('token');
  const location = useLocation();

  if (!token) {
    return <Navigate to="/auth/login" replace />;
  }

  const mustChangePassword = localStorage.getItem('must_change_password') === '1' || sessionStorage.getItem('must_change_password') === '1';
  if (mustChangePassword && location.pathname !== '/auth/change-password') {
    return <Navigate to="/auth/change-password" replace />;
  }

  return <Outlet />;
}
