import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { clearTokens, getAccessToken, mobileApi, storeTokens } from "@/lib/api";
import { User } from "@/types";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  currencySymbol: string;
  currencyCode: string;
  login: (identifier: string, password: string) => Promise<void>;
  loginWithOtp: (
    mobileNumber: string,
    otpOrToken: { otp?: string; verification_token?: string }
  ) => Promise<void>;
  register: (fullName: string, email: string, password: string) => Promise<void>;
  registerWithOtp: (payload: {
    full_name: string;
    mobile_number: string;
    email?: string;
    password: string;
    verification_token?: string;
    otp?: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    const token = await getAccessToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
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

  const login = async (identifier: string, password: string) => {
    const res = await mobileApi.login({ identifier, password });
    await storeTokens(res.access_token, res.refresh_token);
    setUser(res.user);
  };

  const loginWithOtp = async (
    mobileNumber: string,
    otpOrToken: { otp?: string; verification_token?: string }
  ) => {
    const res = await mobileApi.loginWithOtp({ mobile_number: mobileNumber, ...otpOrToken });
    await storeTokens(res.access_token, res.refresh_token);
    setUser(res.user);
  };

  const register = async (fullName: string, email: string, password: string) => {
    const res = await mobileApi.register({ full_name: fullName, email, password });
    await storeTokens(res.access_token, res.refresh_token);
    setUser(res.user);
  };

  const registerWithOtp = async (payload: {
    full_name: string;
    mobile_number: string;
    email?: string;
    password: string;
    verification_token?: string;
    otp?: string;
  }) => {
    const res = await mobileApi.registerWithOtp(payload);
    await storeTokens(res.access_token, res.refresh_token);
    setUser(res.user);
  };

  const logout = async () => {
    try {
      await mobileApi.logout();
    } catch {
      // ignore offline
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
        loginWithOtp,
        register,
        registerWithOtp,
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
