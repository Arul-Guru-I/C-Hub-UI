import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

interface ProtectedRouteProps {
  requiresRole?: string;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ requiresRole }) => {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'var(--color-primary)' }}>
        Loading...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requiresRole && user?.role !== requiresRole) {
    return <Navigate to="/" replace />; 
  }

  return <Outlet />;
};

export default ProtectedRoute;
