// src/contexts/AuthContext.tsx
import React, { createContext, useContext, useEffect, useState } from "react";

type User = {
  user_id?: number;
  username?: string;
  email?: string;
  role?: string;
} | null;

type AuthCtx = {
  user: User;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthCtx | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const refresh = async () => {
    setLoading(true);
    try {
      // Default to relative paths so Vite's dev proxy handles /api and keeps requests same-origin
      const rawApiBase = (import.meta.env.VITE_API_BASE as string) ?? "";
      const apiBase = rawApiBase ? rawApiBase.replace(/\/+$/, "") : "";

      // Try cookie-based session first (httpOnly cookie set by backend)
      const res = await fetch(`${apiBase}/api/v1/auth/me/`, {
        credentials: "include",
      });

      if (!res.ok) {
        // Cookie-based session missing or invalid
        setUser(null);
        return;
      }

      const j = await res.json().catch(() => null);
      if (!j) {
        setUser(null);
        return;
      }

  // infer role if backend doesn't send it. Treat DeliveryPartner as agent-role for UI compatibility.
  const role = j?.is_staff || j?.is_superuser ? "admin" : (j?.is_partner || j?.is_agent) ? "agent" : "user";
      setUser({ ...j, role });
    } catch (e) {
      console.warn("Auth refresh error:", e);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      const rawApiBase = (import.meta.env.VITE_API_BASE as string) || "http://127.0.0.1:8000";
      const apiBase = rawApiBase.replace(/\/+$/, "");
      await fetch(`${apiBase}/api/v1/auth/logout/`, { method: "POST", credentials: "include" });
    } catch (e) {
      console.warn("Logout error:", e);
    }
    setUser(null);
  };

  useEffect(() => {
    refresh();
  }, []);

  return <AuthContext.Provider value={{ user, loading, refresh, logout }}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
};
