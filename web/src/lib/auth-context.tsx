"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, clearTokens, getStoredAccessToken, storeTokens } from "@/lib/api";
import { User } from "@/types";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  currencySymbol: string;
  currencyCode: string;
  login: (email: string, password: string) => Promise<void>;
  register: (fullName: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const refreshUser = useCallback(async () => {
    const token = getStoredAccessToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const me = await api.me();
      setUser(me);
    } catch {
      clearTokens();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = async (email: string, password: string) => {
    const res = await api.login({ email, password });
    storeTokens(res.access_token, res.refresh_token);
    setUser(res.user);
    router.push("/dashboard");
  };

  const register = async (fullName: string, email: string, password: string) => {
    const res = await api.register({ full_name: fullName, email, password });
    storeTokens(res.access_token, res.refresh_token);
    setUser(res.user);
    router.push("/dashboard");
  };

  const logout = async () => {
    try {
      await api.logout();
    } catch {
      // ignore if token already expired
    } finally {
      clearTokens();
      setUser(null);
      router.push("/login");
    }
  };

  const currencySymbol = user?.settings?.currency_symbol || "₹";
  const currencyCode = user?.settings?.currency_code || "INR";

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        currencySymbol,
        currencyCode,
        login,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
