import { Navigate, Outlet } from 'react-router-dom';

export function GuestRoute() {
  const token = localStorage.getItem('token');
  
  if (token) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return <Outlet />;
}
