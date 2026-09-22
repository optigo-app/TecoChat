// Ported from OldChatReactCode/src/contexts/FavoriteContext.js

"use client";

import { createContext, useContext, useState, useCallback, useEffect } from "react";

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

  // Keep favoriteState in sync when IsStar changes from OUTSIDE this
  // context — e.g. the conversation-list context menu dispatches
  // UPDATE_CONVERSATION_ITEM after a successful API call. Without this,
  // a stale context entry wins over selectedCustomer.IsStar in ChatPanel's
  // isFavorite fallback and the header menu stops reflecting list-side
  // toggles after the first header-side toggle.
  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (!detail) return;
      const convId = detail.ConversationId ?? detail.conversationId;
      if (convId == null || detail.IsStar === undefined) return;
      updateFavoriteStatus(convId, detail.IsStar);
    };
    window.addEventListener("UPDATE_CONVERSATION_ITEM", handler as EventListener);
    return () => {
      window.removeEventListener("UPDATE_CONVERSATION_ITEM", handler as EventListener);
    };
  }, [updateFavoriteStatus]);

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
