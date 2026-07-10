import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useUser } from '../../authorization/UserContext';

export const AdminRoute: React.FC = () => {
  const { user } = useUser();

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (!user.is_admin) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
};

export default AdminRoute;