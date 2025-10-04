"use client";

import React, { createContext, useContext, useCallback, useState, useEffect } from "react";
import type { User } from "@/lib/api/types";
import { apiFetch } from "@/lib/api/client";

interface AuthContextValue {
  user: User | null;
  apiKey: string | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const API_KEY_STORAGE_KEY = "flix_audio_api_key";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load user on mount if API key exists
  useEffect(() => {
    const loadUser = async () => {
      const storedKey = localStorage.getItem(API_KEY_STORAGE_KEY);
      if (!storedKey) {
        setIsLoading(false);
        return;
      }

      try {
        const response = await apiFetch<{ data: User }>("/users/me", {
          authToken: storedKey,
        });
        setUser(response.data);
        setApiKey(storedKey);
      } catch (error) {
        // Invalid token, clear it
        localStorage.removeItem(API_KEY_STORAGE_KEY);
        setApiKey(null);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    loadUser();
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const response = await apiFetch<{ data: { user: User; api_key: string } }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });

    const { user: userData, api_key } = response.data;

    // Store API key
    localStorage.setItem(API_KEY_STORAGE_KEY, api_key);
    setApiKey(api_key);
    setUser(userData);
  }, []);

  const logout = useCallback(async () => {
    if (!apiKey) return;

    try {
      await apiFetch("/auth/logout", {
        method: "POST",
        authToken: apiKey,
      });
    } catch (error) {
      // Even if the server request fails, we still clear local state
      console.error("Logout error:", error);
    } finally {
      // Clear local state
      localStorage.removeItem(API_KEY_STORAGE_KEY);
      setApiKey(null);
      setUser(null);
    }
  }, [apiKey]);

  const refreshUser = useCallback(async () => {
    if (!apiKey) return;

    try {
      const response = await apiFetch<{ data: User }>("/users/me", {
        authToken: apiKey,
      });
      setUser(response.data);
    } catch (error) {
      // If refresh fails, clear auth state
      localStorage.removeItem(API_KEY_STORAGE_KEY);
      setApiKey(null);
      setUser(null);
    }
  }, [apiKey]);

  const value: AuthContextValue = {
    user,
    apiKey,
    isAuthenticated: !!user && !!apiKey,
    isAdmin: user?.is_admin ?? false,
    isLoading,
    login,
    logout,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
