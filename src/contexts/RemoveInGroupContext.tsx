// Ported from OldChatReactCode/src/contexts/RemoveInGroupContext.js

"use client";

import { createContext, useContext, useState, useCallback } from "react";

type ConversationId = string | number;

interface RemoveInGroupEntry {
  isRemoved: boolean;
}

interface RemoveInGroupContextValue {
  removeInGroupState: Record<ConversationId, RemoveInGroupEntry>;
  updateRemoveInGroupStatus: (
    conversationId: ConversationId,
    isRemoved: boolean | number
  ) => void;
  isRemovedFromGroup: (conversationId: ConversationId) => boolean | undefined;
  clearRemoveInGroupStatus: (conversationId: ConversationId) => void;
}

const RemoveInGroupContext = createContext<
  RemoveInGroupContextValue | undefined
>(undefined);

export const useRemoveInGroup = (): RemoveInGroupContextValue => {
  const context = useContext(RemoveInGroupContext);
  if (!context) {
    throw new Error(
      "useRemoveInGroup must be used within a RemoveInGroupProvider"
    );
  }
  return context;
};

export const RemoveInGroupProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [removeInGroupState, setRemoveInGroupState] = useState<
    Record<ConversationId, RemoveInGroupEntry>
  >({});

  const updateRemoveInGroupStatus = useCallback(
    (conversationId: ConversationId, isRemoved: boolean | number) => {
      setRemoveInGroupState((prev) => ({
        ...prev,
        [conversationId]: {
          isRemoved: isRemoved === 1 || isRemoved === true,
        },
      }));
    },
    []
  );

  const isRemovedFromGroup = useCallback(
    (conversationId: ConversationId) => {
      return removeInGroupState[conversationId]?.isRemoved;
    },
    [removeInGroupState]
  );

  const clearRemoveInGroupStatus = useCallback(
    (conversationId: ConversationId) => {
      setRemoveInGroupState((prev) => {
        const newState = { ...prev };
        delete newState[conversationId];
        return newState;
      });
    },
    []
  );

  const value: RemoveInGroupContextValue = {
    removeInGroupState,
    updateRemoveInGroupStatus,
    isRemovedFromGroup,
    clearRemoveInGroupStatus,
  };

  return (
    <RemoveInGroupContext.Provider value={value}>
      {children}
    </RemoveInGroupContext.Provider>
  );
};
