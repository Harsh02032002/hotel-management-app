import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { apiFetch, onSessionExpired, TOKEN_KEY } from "@/src/api/client";
import { storage } from "@/src/utils/storage";

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  department: string;
  shift: string;
};

type AuthContextType = {
  admin: AdminUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>(null!);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);

  const restore = useCallback(async () => {
    try {
      const token = await storage.secureGet<string | null>(TOKEN_KEY, null);
      if (!token) {
        setAdmin(null);
        return;
      }
      const me = await apiFetch<AdminUser>("/api/admin/auth/me");
      setAdmin(me);
    } catch {
      await storage.secureRemove(TOKEN_KEY);
      setAdmin(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const unsub = onSessionExpired(() => setAdmin(null));
    restore();
    return unsub;
  }, [restore]);

  const signIn = async (email: string, password: string) => {
    const data = await apiFetch<{ token: string; admin: AdminUser }>("/api/admin/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: email.toLowerCase().trim(), password }),
    });
    await storage.secureSet(TOKEN_KEY, data.token);
    setAdmin(data.admin);
  };

  const signOut = async () => {
    await storage.secureRemove(TOKEN_KEY);
    setAdmin(null);
  };

  return (
    <AuthContext.Provider value={{ admin, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
