"use client";

import { decodeToken, TokenPayload } from "@/services/auth/decodeToken";
import React, { createContext, useContext, useState } from "react";

type AuthContextType = {
  user: TokenPayload | null;
  isAuthenticated: boolean;
  loading: boolean;
  setUser: React.Dispatch<React.SetStateAction<TokenPayload | null>>; 
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  isAuthenticated: false,
  loading: true,
  setUser: () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<TokenPayload | null>(() => decodeToken());
  const loading = false;

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        loading,
        setUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);