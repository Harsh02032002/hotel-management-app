import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { apiFetch, onSessionExpired, TOKEN_KEY } from "@/src/api/client";
import { storage } from "@/src/utils/storage";

export type CustomerUser = {
  id: string;
  name: string;
  email: string;
  phone: string;
  address?: string;
  id_type?: string;
  id_number?: string;
};

type AuthContextType = {
  user: CustomerUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, phone: string, password: string) => Promise<void>;
  sendOtp: (phoneOrEmail: string) => Promise<{ otp_preview?: string; message: string }>;
  verifyOtp: (phoneOrEmail: string, otp: string) => Promise<void>;
  updateProfile: (patch: Partial<CustomerUser>) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>(null!);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CustomerUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const token = await storage.secureGet<string | null>(TOKEN_KEY, null);
      if (!token) {
        setUser(null);
        return;
      }
      const me = await apiFetch<CustomerUser>("/api/auth/me");
      setUser(me);
    } catch {
      await storage.secureRemove(TOKEN_KEY);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const unsub = onSessionExpired(() => setUser(null));
    refreshUser();
    return unsub;
  }, [refreshUser]);

  const persist = async (token: string, u: CustomerUser) => {
    await storage.secureSet(TOKEN_KEY, token);
    setUser(u);
  };

  const signIn = async (email: string, password: string) => {
    const data = await apiFetch<{ token: string; user: CustomerUser }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    await persist(data.token, data.user);
  };

  const signUp = async (name: string, email: string, phone: string, password: string) => {
    const data = await apiFetch<{ token: string; user: CustomerUser }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ name, email, phone, password }),
    });
    await persist(data.token, data.user);
  };

  const sendOtp = async (phoneOrEmail: string) => {
    return apiFetch<{ ok: boolean; message: string; otp_preview?: string }>("/api/auth/send-otp", {
      method: "POST",
      body: JSON.stringify({ phone_or_email: phoneOrEmail }),
    });
  };

  const verifyOtp = async (phoneOrEmail: string, otp: string) => {
    const data = await apiFetch<{ token: string; user: CustomerUser }>("/api/auth/verify-otp", {
      method: "POST",
      body: JSON.stringify({ phone_or_email: phoneOrEmail, otp }),
    });
    await persist(data.token, data.user);
  };

  const updateProfile = async (patch: Partial<CustomerUser>) => {
    const updated = await apiFetch<CustomerUser>("/api/auth/profile", {
      method: "PUT",
      body: JSON.stringify(patch),
    });
    setUser(updated);
  };

  const signOut = async () => {
    await storage.secureRemove(TOKEN_KEY);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, signIn, signUp, sendOtp, verifyOtp, updateProfile, signOut, refreshUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
