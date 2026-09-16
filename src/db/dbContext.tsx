"use client";

import React, { createContext, useContext, useEffect, useMemo } from "react";
import { getDb, closeDb } from "./tecoDb";
import type { TecoChatDatabase } from "./tecoDb";
import { useLoginContext } from "../contexts/LoginData";

const DbContext = createContext<TecoChatDatabase | null>(null);

export function DbProvider({ children }: { children: React.ReactNode }) {
  const { auth } = useLoginContext();
  const authId = auth?.id ?? auth?.userId;

  const db = useMemo(() => {
    return getDb(authId);
  }, [authId]);

  useEffect(() => {
    // Request persistent storage so the browser is less likely to evict
    // the per-user IndexedDB under disk pressure. Best-effort, no-op if
    // unsupported or denied.
    if (authId && typeof navigator !== "undefined" && navigator.storage?.persist) {
      navigator.storage.persist().catch(() => {
        /* ignore */
      });
    }
    return () => {
      if (authId) closeDb(authId);
    };
  }, [authId]);

  return <DbContext.Provider value={db}>{children}</DbContext.Provider>;
}

export function useDb(): TecoChatDatabase | null {
  return useContext(DbContext);
}
