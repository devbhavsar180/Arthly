import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { clearTokens, getAccessToken, mobileApi, storeTokens } from "@/lib/api";
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

  const refreshUser = useCallback(async () => {
    try {
      const token = await getAccessToken();
      if (!token) {
        setUser(null);
        return;
      }
      const me = await mobileApi.me();
      setUser(me);
    } catch {
      await clearTokens();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = async (email: string, password: string) => {
    const res = await mobileApi.login({ email, password });
    await storeTokens(res.access_token, res.refresh_token);
    setUser(res.user);
  };

  const register = async (fullName: string, email: string, password: string) => {
    const res = await mobileApi.register({ full_name: fullName, email, password });
    await storeTokens(res.access_token, res.refresh_token);
    setUser(res.user);
  };

  const logout = async () => {
    try {
      await mobileApi.logout();
    } catch {
      // ignore network error on logout
    } finally {
      await clearTokens();
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        currencySymbol: user?.settings?.currency_symbol || "₹",
        currencyCode: user?.settings?.currency_code || "INR",
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
