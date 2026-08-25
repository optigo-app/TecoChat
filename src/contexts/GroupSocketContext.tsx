// Ported from OldChatReactCode/src/contexts/GroupSocketContext.js

"use client";

import { createContext, useContext, useEffect, useRef, useCallback } from "react";
import {
  addGroupEventHandler,
  addGroupMemberHandler,
  addGroupPermissionHandler,
} from "../socket";

type ConversationId = string | number;
type Handler = (data: any) => void;

interface GroupSocketCallbacks {
  onGroupEvent?: Handler;
  onMemberEvent?: Handler;
  onPermissionEvent?: Handler;
}

interface GroupSocketContextValue {
  registerListener: (
    conversationId: ConversationId,
    callbacks: GroupSocketCallbacks
  ) => void;
  unregisterListener: (conversationId: ConversationId) => void;
}

const GroupSocketContext = createContext<GroupSocketContextValue | undefined>(
  undefined
);

export const useGroupSocket = (): GroupSocketContextValue => {
  const context = useContext(GroupSocketContext);
  if (!context) {
    throw new Error("useGroupSocket must be used within a GroupSocketProvider");
  }
  return context;
};

export const GroupSocketProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const listenersRef = useRef({
    groupEvent: new Map<ConversationId, Handler>(),
    memberEvent: new Map<ConversationId, Handler>(),
    permissionEvent: new Map<ConversationId, Handler>(),
  });

  const handleGroupEvent = useCallback((data: any) => {
    if (!data || !data.conversationId) return;
    const { conversationId } = data;
    const listener = listenersRef.current.groupEvent.get(conversationId);
    if (listener) {
      try {
        listener(data);
      } catch (error) {
        console.error("Error in group event listener:", error);
      }
    }
  }, []);

  const handleMemberEvent = useCallback((data: any) => {
    if (!data || !data.conversationId) return;
    const { conversationId } = data;
    const listener = listenersRef.current.memberEvent.get(conversationId);
    if (listener) {
      try {
        listener(data);
      } catch (error) {
        console.error("Error in member event listener:", error);
      }
    }
  }, []);

  const handlePermissionEvent = useCallback((data: any) => {
    if (!data || !data.conversationId) return;
    const { conversationId } = data;
    const listener = listenersRef.current.permissionEvent.get(conversationId);
    if (listener) {
      try {
        listener(data);
      } catch (error) {
        console.error("Error in permission event listener:", error);
      }
    }
  }, []);

  useEffect(() => {
    const cleanup1 = addGroupEventHandler(handleGroupEvent);
    const cleanup2 = addGroupMemberHandler(handleMemberEvent);
    const cleanup3 = addGroupPermissionHandler(handlePermissionEvent);

    return () => {
      if (cleanup1) cleanup1();
      if (cleanup2) cleanup2();
      if (cleanup3) cleanup3();
    };
  }, [handleGroupEvent, handleMemberEvent, handlePermissionEvent]);

  const registerListener = useCallback(
    (conversationId: ConversationId, callbacks: GroupSocketCallbacks) => {
      if (callbacks.onGroupEvent) {
        listenersRef.current.groupEvent.set(conversationId, callbacks.onGroupEvent);
      }
      if (callbacks.onMemberEvent) {
        listenersRef.current.memberEvent.set(conversationId, callbacks.onMemberEvent);
      }
      if (callbacks.onPermissionEvent) {
        listenersRef.current.permissionEvent.set(
          conversationId,
          callbacks.onPermissionEvent
        );
      }
    },
    []
  );

  const unregisterListener = useCallback((conversationId: ConversationId) => {
    listenersRef.current.groupEvent.delete(conversationId);
    listenersRef.current.memberEvent.delete(conversationId);
    listenersRef.current.permissionEvent.delete(conversationId);
  }, []);

  const value: GroupSocketContextValue = { registerListener, unregisterListener };

  return (
    <GroupSocketContext.Provider value={value}>
      {children}
    </GroupSocketContext.Provider>
  );
};
