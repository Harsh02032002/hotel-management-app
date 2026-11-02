import { storage } from "@/src/utils/storage";

export const DEFAULT_PRODUCTION_API_URL = "https://hotel-management-backend-beta.vercel.app";
export const API_URL = (process.env.EXPO_PUBLIC_BACKEND_URL || DEFAULT_PRODUCTION_API_URL).trim().replace(/\/+$/, "");
export const TOKEN_KEY = "grandpalace_admin_token";

type SessionExpiredListener = () => void;
const sessionListeners = new Set<SessionExpiredListener>();

export function onSessionExpired(listener: SessionExpiredListener): () => void {
  sessionListeners.add(listener);
  return () => sessionListeners.delete(listener);
}

export async function getToken(): Promise<string | null> {
  return storage.secureGet<string | null>(TOKEN_KEY, null);
}

export async function apiFetch<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...((options.headers as Record<string, string>) ?? {}),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { ...options, headers });
  } catch {
    throw new Error("Network error: Please check your internet connection.");
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && token && !path.includes("/auth/")) {
      await storage.secureRemove(TOKEN_KEY);
      sessionListeners.forEach((fn) => fn());
    }
    const detail = (data as any)?.detail || (data as any)?.message;
    throw new Error(typeof detail === "string" ? detail : `Request failed (${res.status})`);
  }
  return data as T;
}
