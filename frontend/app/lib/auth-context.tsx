'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { User } from '@/app/types';
import { me, googleSignIn as googleSignInFn, login, register } from './user';
import { getToken, setToken, clearToken } from './api';

export interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  googleSignIn: (idToken: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function initAuth() {
      const token = getToken();
      if (token) {
        try {
          const userData = await me();
          setUser(userData);
        } catch (error) {
          clearToken();
          setUser(null);
        }
      }
      setLoading(false);
    }

    initAuth();
  }, []);

  const handleLogin = async (email: string, password: string) => {
    const userData = await login(email, password);
    setUser(userData);
  };

  const handleRegister = async (name: string, email: string, password: string) => {
    const userData = await register(name, email, password);
    setUser(userData);
  };

  const handleGoogleSignIn = async (idToken: string) => {
    const userData = await googleSignInFn(idToken);
    setUser(userData);
  };

  const handleLogout = () => {
    clearToken();
    setUser(null);
  };

  const value: AuthContextType = {
    user,
    loading,
    isAuthenticated: !!user,
    login: handleLogin,
    register: handleRegister,
    googleSignIn: handleGoogleSignIn,
    logout: handleLogout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

