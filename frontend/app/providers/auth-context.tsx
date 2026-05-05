'use client';

import React, { createContext, useEffect, useState } from 'react';
import { jwtDecode } from 'jwt-decode';
import { getToken, setToken, clearToken } from '@/app/lib/api';

export interface AuthUser {
  username: string;
  roles?: string[];
  email?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (usernameAndPassword: { username: string; password: string }) => Promise<void>;
  logout: () => void;
  setUser: (user: AuthUser | null) => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore user from token on mount
  useEffect(() => {
    const token = getToken();
    if (token) {
      try {
        const decoded: any = jwtDecode(token);
        if (isTokenValid(token)) {
          setUser({
            username: decoded.sub,
            roles: decoded.scopes,
            email: decoded.email,
          });
        } else {
          clearToken();
        }
      } catch (error) {
        clearToken();
        setUser(null);
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (credentials: { username: string; password: string }) => {
    setIsLoading(true);
    try {
      // TODO: Replace with actual API call once backend is ready
      // const response = await fetch('/api/v1/auth/login', { ... });
      // For now, this is a placeholder
      console.log('Login called with:', credentials);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    clearToken();
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        setUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// Helper function to check if token is still valid
function isTokenValid(token: string): boolean {
  try {
    const decoded: any = jwtDecode(token);
    if (!decoded.exp) return true;
    return Date.now() < decoded.exp * 1000;
  } catch {
    return false;
  }
}
