"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { AuthSession, RoleName, Tenant, User } from "../types/domain";
import { apiClient, setTokens, getAccessToken, ApiError } from "./api";

// Role-Based Access Control matrix for the frontend
export const ROLE_PERMISSIONS: Record<RoleName, string[]> = {
  OWNER: ["*"],
  ADMINISTRATOR: [
    "dashboard:view", "products:read", "products:write", "inventory:read", "inventory:write",
    "warehouses:read", "warehouses:write", "suppliers:read", "suppliers:write",
    "purchases:read", "purchases:write", "customers:read", "customers:write",
    "quotations:read", "quotations:write", "orders:read", "orders:write",
    "production:read", "production:write", "dispatch:read", "dispatch:write",
    "invoices:read", "invoices:write", "payments:read", "payments:write",
    "reports:read", "audit:read", "users:read", "users:write", "settings:write"
  ],
  MANAGER: [
    "dashboard:view", "products:read", "products:write", "inventory:read", "inventory:write",
    "warehouses:read", "suppliers:read", "suppliers:write", "purchases:read", "purchases:write",
    "customers:read", "customers:write", "quotations:read", "quotations:write",
    "orders:read", "orders:write", "production:read", "production:write",
    "dispatch:read", "dispatch:write", "invoices:read", "invoices:write",
    "payments:read", "reports:read"
  ],
  SALES_STAFF: [
    "dashboard:view", "products:read", "inventory:read", "customers:read", "customers:write",
    "quotations:read", "quotations:write", "orders:read", "orders:write", "invoices:read"
  ],
  WAREHOUSE_STAFF: [
    "dashboard:view", "products:read", "inventory:read", "inventory:write",
    "warehouses:read", "purchases:read", "purchases:write", "orders:read",
    "dispatch:read", "dispatch:write"
  ],
  PRODUCTION_STAFF: [
    "dashboard:view", "products:read", "inventory:read", "production:read", "production:write"
  ],
  ACCOUNTANT: [
    "dashboard:view", "products:read", "inventory:read", "customers:read", "suppliers:read",
    "orders:read", "invoices:read", "invoices:write", "payments:read", "payments:write",
    "reports:read", "audit:read"
  ],
  VIEWER: [
    "dashboard:view", "products:read", "inventory:read", "warehouses:read",
    "suppliers:read", "purchases:read", "customers:read", "quotations:read",
    "orders:read", "production:read", "dispatch:read", "invoices:read",
    "payments:read", "reports:read"
  ]
};

interface AuthContextType {
  session: AuthSession | null;
  user: User | null;
  tenant: Tenant | null;
  role: RoleName;
  isLoading: boolean;
  login: (credentials: { email: string; password: string }) => Promise<void>;
  register: (payload: any) => Promise<void>;
  logout: () => Promise<void>;
  switchRole: (role: RoleName) => void;
  hasPermission: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [role, setRole] = useState<RoleName>("OWNER");
  const [isLoading, setIsLoading] = useState(true);

  // Restore a previous session (silent refresh). Real accounts only: no automatic demo login.
  useEffect(() => {
    async function initAuth() {
      try {
        // Attempt silent refresh first (skipped on a first visit to avoid a pointless 401)
        let hadSession = false;
        try { hadSession = localStorage.getItem("sp-had-session") === "1"; } catch {}
        if (!hadSession) throw new Error("no previous session");
        const refreshed = await apiClient<AuthSession>("/auth/refresh", {
          method: "POST",
          skipAuth: true
        });
        if (refreshed) {
          applySession(refreshed);
          return;
        }
      } catch {
        // No saved session: the visitor is sent to the sign-in page by the app shell.
      } finally {
        setIsLoading(false);
      }
    }

    initAuth();
  }, []);

  function applySession(newSession: AuthSession) {
    try { localStorage.setItem("sp-had-session", "1"); } catch {}
    setTokens(newSession.accessToken, newSession.refreshToken);
    setSession(newSession);
    setUser({
      id: newSession.userId,
      email: newSession.email,
      fullName: newSession.fullName,
      role: newSession.role
    });
    setRole(newSession.role);
    setTenant({
      id: newSession.tenantId,
      name: newSession.tenantName,
      slug: newSession.tenantSlug || "",
      currencyCode: newSession.currencyCode || "INR",
      countryCode: "IN",
      taxRegistrationNo: newSession.taxRegistrationNo ?? null,
      financialYearStart: newSession.financialYearStart || 4,
      allowNegativeStock: false,
      valuationMethod: "WEIGHTED_AVERAGE",
      planTier: newSession.planTier || "GROWTH",
      isDemo: Boolean(newSession.isDemo),
      createdAt: new Date().toISOString()
    });
  }

  const login = async (credentials: { email: string; password: string }) => {
    const data = await apiClient<AuthSession>("/auth/login", {
      method: "POST",
      skipAuth: true,
      body: JSON.stringify(credentials)
    });
    applySession(data);
  };

  const register = async (payload: any) => {
    const res = await apiClient<{ tenant: Tenant; user: User; session: AuthSession }>("/auth/register", {
      method: "POST",
      skipAuth: true,
      body: JSON.stringify(payload)
    });
    applySession(res.session);
  };

  const logout = async () => {
    try {
      await apiClient("/auth/logout", { method: "POST" });
    } catch {
      // Ignore logout errors
    } finally {
      try { localStorage.removeItem("sp-had-session"); } catch {}
      setTokens(null, null);
      setSession(null);
      setUser(null);
      setTenant(null);
    }
  };

  const switchRole = (newRole: RoleName) => {
    setRole(newRole);
    if (session) {
      setSession({ ...session, role: newRole });
    }
    if (user) {
      setUser({ ...user, role: newRole });
    }
  };

  const hasPermission = (permission: string): boolean => {
    const perms = ROLE_PERMISSIONS[role] || [];
    if (perms.includes("*")) return true;
    return perms.includes(permission);
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        tenant,
        role,
        isLoading,
        login,
        register,
        logout,
        switchRole,
        hasPermission
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
