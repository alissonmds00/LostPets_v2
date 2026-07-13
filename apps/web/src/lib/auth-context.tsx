"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import * as api from "./api";
import type { AuthenticatedUser } from "./types";

type AuthContextValue = {
  user: AuthenticatedUser | null;
  loading: boolean;
  login: (input: { email: string; password: string }) => Promise<void>;
  register: (input: {
    email: string;
    password: string;
    name: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  // Starts true: every consumer (route guards included) must wait for the
  // /me check to resolve before deciding whether the visitor is signed in —
  // otherwise a guarded page flashes its "not authenticated" state on every
  // full page load while the cookie is still being checked.
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getMe()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(
    async (input: { email: string; password: string }) => {
      const { user: loggedInUser } = await api.login(input);
      setUser(loggedInUser);
    },
    [],
  );

  const register = useCallback(
    async (input: { email: string; password: string; name: string }) => {
      await api.registerUser(input);
      await login({ email: input.email, password: input.password });
    },
    [login],
  );

  const logout = useCallback(async () => {
    await api.logout();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
