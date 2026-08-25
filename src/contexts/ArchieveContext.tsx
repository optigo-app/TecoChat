// Ported from OldChatReactCode/src/contexts/ArchieveContext.js

"use client";

import { createContext, useContext, useState } from "react";

interface ArchieveContextValue {
  archieve: unknown;
  addArchieve: (arch: unknown) => void;
}

const ArchieveContext = createContext<ArchieveContextValue | undefined>(undefined);

export const useArchieveContext = (): ArchieveContextValue => {
  const ctx = useContext(ArchieveContext);
  if (!ctx) {
    throw new Error("useArchieveContext must be used within an ArchieveProvider");
  }
  return ctx;
};

export const ArchieveProvider = ({ children }: { children: React.ReactNode }) => {
  const [archieve, setArchieve] = useState<unknown>(null);

  const addArchieve = (arch: unknown) => {
    setArchieve(arch);
  };

  return (
    <ArchieveContext.Provider value={{ archieve, addArchieve }}>
      {children}
    </ArchieveContext.Provider>
  );
};
