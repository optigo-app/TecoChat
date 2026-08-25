// Ported from OldChatReactCode/src/contexts/FavoriteContext.js

"use client";

import { createContext, useContext, useState, useCallback } from "react";

interface FavoriteEntry {
  isStar: number;
  timestamp: number;
}

interface FavoriteContextValue {
  favoriteState: Record<string | number, FavoriteEntry>;
  getFavoriteStatus: (conversationId: string | number) => number | undefined;
  updateFavoriteStatus: (conversationId: string | number, isStar: number) => void;
}

const FavoriteContext = createContext<FavoriteContextValue | undefined>(undefined);

export const FavoriteProvider = ({ children }: { children: React.ReactNode }) => {
  const [favoriteState, setFavoriteState] = useState<
    Record<string | number, FavoriteEntry>
  >({});

  const getFavoriteStatus = useCallback(
    (conversationId: string | number) => {
      return favoriteState[conversationId]?.isStar;
    },
    [favoriteState]
  );

  const updateFavoriteStatus = useCallback(
    (conversationId: string | number, isStar: number) => {
      setFavoriteState((prev) => ({
        ...prev,
        [conversationId]: {
          isStar,
          timestamp: Date.now(),
        },
      }));
    },
    []
  );

  const value: FavoriteContextValue = {
    favoriteState,
    getFavoriteStatus,
    updateFavoriteStatus,
  };

  return (
    <FavoriteContext.Provider value={value}>{children}</FavoriteContext.Provider>
  );
};

export const useFavorite = (): FavoriteContextValue => {
  const context = useContext(FavoriteContext);
  if (!context) {
    throw new Error("useFavorite must be used within a FavoriteProvider");
  }
  return context;
};
