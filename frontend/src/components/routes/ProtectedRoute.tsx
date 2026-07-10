import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useUser } from '../../authorization/UserContext';

export const ProtectedRoute: React.FC = () => {
  const { user } = useUser();

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;