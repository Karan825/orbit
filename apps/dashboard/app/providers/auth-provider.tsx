'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  role: 'admin' | 'member';
}

interface AuthContextType {
  user: AuthUser;
  login: (user: AuthUser) => void;
  logout: () => void;
  isAdmin: boolean;
  isMember: boolean;
  isReady: boolean;
}

export const defaultAdmin: AuthUser = {
  id: 'bc3f0608-3722-498e-9ab6-a704cf16090c',
  email: 'alice@urumi.local',
  displayName: 'Alice (Admin)',
  role: 'admin',
};

export const defaultMember: AuthUser = {
  id: 'b0b0b0b0-0000-0000-0000-000000000001',
  email: 'bob@urumi.local',
  displayName: 'Bob (Member)',
  role: 'member',
};

const AuthContext = createContext<AuthContextType>({
  user: defaultAdmin,
  login: () => {},
  logout: () => {},
  isAdmin: true,
  isMember: false,
  isReady: false,
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<AuthUser>(defaultAdmin);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('urumi_user');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.role) {
          setUser(parsed);
        }
      }
    } catch {
      // Storage unavailable, fallback to default
    } finally {
      setIsReady(true);
    }
  }, []);

  const login = (newUser: AuthUser) => {
    setUser(newUser);
    try {
      localStorage.setItem('urumi_user', JSON.stringify(newUser));
    } catch {}
  };

  const logout = () => {
    setUser(defaultAdmin);
    try {
      localStorage.removeItem('urumi_user');
    } catch {}
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
        isAdmin: user.role === 'admin',
        isMember: user.role === 'member',
        isReady,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);