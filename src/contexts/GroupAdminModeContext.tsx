// Ported from OldChatReactCode/src/contexts/GroupAdminModeContext.js

"use client";

import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { addGroupPermissionHandler } from "../socket";

type ConversationId = string | number;
type GroupSettings = Record<string, unknown>;

interface GroupAdminModeContextValue {
  groupSettingsState: Record<ConversationId, GroupSettings>;
  updateGroupSettings: (
    conversationId: ConversationId,
    settings: GroupSettings
  ) => void;
  getGroupPermission: (
    conversationId: ConversationId,
    permissionName: string
  ) => unknown;
  updateGroupAdminMode: (
    conversationId: ConversationId,
    isOnlyAdminSend: boolean
  ) => void;
  isGroupOnlyAdminSend: (conversationId: ConversationId) => boolean;
}

const GroupAdminModeContext = createContext<
  GroupAdminModeContextValue | undefined
>(undefined);

export const useGroupAdminMode = (): GroupAdminModeContextValue => {
  const context = useContext(GroupAdminModeContext);
  if (!context) {
    throw new Error(
      "useGroupAdminMode must be used within a GroupAdminModeProvider"
    );
  }
  return context;
};

export const GroupAdminModeProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [groupSettingsState, setGroupSettingsState] = useState<
    Record<ConversationId, GroupSettings>
  >({});

  const updateGroupSettings = useCallback(
    (conversationId: ConversationId, settings: GroupSettings) => {
      if (!conversationId || !settings) return;

      // Filter out undefined values
      const filteredSettings = Object.entries(settings).reduce<
        Record<string, unknown>
      >((acc, [key, value]) => {
        if (value !== undefined) acc[key] = value;
        return acc;
      }, {});

      if (Object.keys(filteredSettings).length === 0) return;

      setGroupSettingsState((prev) => ({
        ...prev,
        [conversationId]: {
          ...(prev[conversationId] || {}),
          ...filteredSettings,
        },
      }));
    },
    []
  );

  const getGroupPermission = useCallback(
    (conversationId: ConversationId, permissionName: string) => {
      return groupSettingsState[conversationId]?.[permissionName];
    },
    [groupSettingsState]
  );

  const updateGroupAdminMode = useCallback(
    (conversationId: ConversationId, isOnlyAdminSend: boolean) => {
      if (isOnlyAdminSend === undefined || isOnlyAdminSend === null) return;
      updateGroupSettings(conversationId, {
        SendNewMessage: isOnlyAdminSend ? 0 : 1,
      });
    },
    [updateGroupSettings]
  );

  const isGroupOnlyAdminSend = useCallback(
    (conversationId: ConversationId) => {
      const sendNewMessage = getGroupPermission(conversationId, "SendNewMessage");
      return sendNewMessage === 0;
    },
    [getGroupPermission]
  );

  // Global Socket Listener for Permission Changes
  useEffect(() => {
    const unsubscribe = addGroupPermissionHandler((data: any) => {
      if (!data || !data.conversationId) return;
      const { conversationId, permissions, changedPermission } = data;

      if (permissions) {
        updateGroupSettings(conversationId, permissions);
      } else if (changedPermission) {
        updateGroupSettings(conversationId, {
          [changedPermission.name]: changedPermission.value,
        });
      }
    });

    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, [updateGroupSettings]);

  const value: GroupAdminModeContextValue = {
    groupSettingsState,
    updateGroupSettings,
    getGroupPermission,
    updateGroupAdminMode,
    isGroupOnlyAdminSend,
  };

  return (
    <GroupAdminModeContext.Provider value={value}>
      {children}
    </GroupAdminModeContext.Provider>
  );
};
