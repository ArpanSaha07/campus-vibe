'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import type { User } from '@/app/types';
import { me, googleSignIn as googleSignInFn, login, register } from '@/app/lib/user';
import { getToken, setToken, clearToken } from '@/app/lib/api';

export interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  googleSignIn: (idToken: string) => Promise<void>;
  logout: () => void;
  /**
   * Re-reads the account from the server and replaces `user`.
   *
   * Exists because `user` is fetched exactly once, on mount. Anything that
   * changes the account after that -- today only the name, from
   * /profile/edit -- would otherwise leave the navbar and the profile header
   * showing the old value until a reload.
   *
   * `applyUser` is the cheaper path when you already hold the response;
   * this one is for callers that do not.
   */
  refreshUser: () => Promise<void>;
  /** Accepts an already-fetched account, e.g. the body of a PATCH response. */
  applyUser: (user: User) => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

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

  const refreshUser = useCallback(async () => {
    // Only meaningful while signed in. Calling /me without a token 403s, and
    // signing the user out over a failed refresh would be a worse outcome than
    // a stale name, so a failure here is deliberately left to the caller.
    if (!getToken()) return;
    setUser(await me());
  }, []);

  const applyUser = useCallback((next: User) => setUser(next), []);

  const value: AuthContextType = {
    user,
    loading,
    isAuthenticated: !!user,
    login: handleLogin,
    register: handleRegister,
    googleSignIn: handleGoogleSignIn,
    logout: handleLogout,
    refreshUser,
    applyUser,
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

