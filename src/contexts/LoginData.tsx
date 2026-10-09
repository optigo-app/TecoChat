"use client";

import React, {
  createContext,
  useState,
  useEffect,
  useContext,
  useMemo,
} from "react";
import { getCookie, eraseCookie } from "../utils/cookieUtils";

export interface AuthData {
  userId: string;
  username: string;
  ukey: string;
  token: string;
  id: string;
  ufcc: string;
  [key: string]: unknown;
}

export interface TokenData {
  sv: string;
  yc: string;
}

interface LoginContextValue {
  auth: AuthData;
  setAuth: React.Dispatch<React.SetStateAction<AuthData>>;
  token: TokenData;
  setToken: React.Dispatch<React.SetStateAction<TokenData>>;
}

export const LoginContext = createContext<LoginContextValue | undefined>(
  undefined
);

export const useLoginContext = (): LoginContextValue => {
  const ctx = useContext(LoginContext);
  if (!ctx) {
    throw new Error("useLoginContext must be used within a LoginData provider");
  }
  return ctx;
};

const EMPTY_AUTH: AuthData = {
  userId: "",
  username: "",
  ukey: "",
  token: "",
  id: "",
  ufcc: "",
};

const EMPTY_TOKEN: TokenData = { sv: "", yc: "" };

// Provider Component
export const LoginData = ({ children }: { children: React.ReactNode }) => {
  const [token, setToken] = useState<TokenData>(() => {
    if (typeof window === "undefined") return EMPTY_TOKEN;
    try {
      const sessionData = sessionStorage.getItem("token");
      if (sessionData) {
        const parsed = JSON.parse(sessionData);
        return {
          sv: parsed?.sv || parsed?.rd?.[0]?.sv || "",
          yc: parsed?.yc || parsed?.rd?.[0]?.yc || "",
        };
      }
      // Fallback to cookie for Remember Me
      const cookieData = getCookie("token");
      if (cookieData) {
        const parsed = JSON.parse(cookieData);
        return {
          sv: parsed?.sv || "",
          yc: parsed?.yc || "",
        };
      }
    } catch (error) {
      console.error("❌ LoginContext: Error fetching token:", error);
      sessionStorage.removeItem("token");
      eraseCookie("token");
    }
    return EMPTY_TOKEN;
  });

  const [auth, setAuth] = useState<AuthData>(() => {
    if (typeof window === "undefined") return EMPTY_AUTH;
    try {
      const sessionData = sessionStorage.getItem("userData");
      let parsed = null;
      if (sessionData) {
        parsed = JSON.parse(sessionData);
      } else {
        // Fallback to cookie for Remember Me
        const cookieData = getCookie("userData");
        if (cookieData) {
          parsed = JSON.parse(cookieData);
        }
      }

      if (parsed) {
        return {
          ...parsed,
          userId: parsed?.userId || "",
          username: parsed?.username || "",
          ukey: parsed?.ukey || "",
          token: parsed?.token || "",
          id: parsed?.id || "",
          ufcc: parsed?.ufcc || parsed?.companycode || "",
        };
      }
    } catch (error) {
      console.error("❌ LoginContext: Error parsing userData:", error);
      sessionStorage.removeItem("userData");
      sessionStorage.removeItem("isLoggedIn");
      eraseCookie("userData");
    }
    return EMPTY_AUTH;
  });

  // Update sessionStorage whenever auth changes
  useEffect(() => {
    if (auth?.userId) {
      sessionStorage.setItem("userData", JSON.stringify(auth));
      sessionStorage.setItem("isLoggedIn", "true");
    }
  }, [auth]);

  const contextValue = useMemo(
    () => ({
      auth,
      setAuth,
      token,
      setToken,
    }),
    [auth, setAuth, token, setToken]
  );

  return (
    <LoginContext.Provider value={contextValue}>
      {children}
    </LoginContext.Provider>
  );
};
