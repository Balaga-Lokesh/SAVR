// src/components/RequireAuth.tsx
import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Protects routes and waits for auth loading to finish before deciding.
 */
const RequireAuth: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  // Wait while auth status is being determined
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div>Checking authentication…</div>
      </div>
    );
  }

  // If not authenticated, redirect to login
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Authenticated — render children
  return <>{children}</>;
};

export default RequireAuth;
