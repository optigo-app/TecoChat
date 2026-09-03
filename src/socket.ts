import { io, type Socket } from "socket.io-client";

const LOCAL_HOSTNAMES = (process.env.NEXT_PUBLIC_LOCAL_HOSTS || "localhost,nzen,tecochat.web,web")
  .split(",")
  .map((h) => h.trim())
  .filter(Boolean);

const isLocal = (): boolean => {
  if (typeof window === "undefined") return false;
  return LOCAL_HOSTNAMES.includes(window.location.hostname);
};

const API_SOCKET_BASE_URL = isLocal()
  ? process.env.NEXT_PUBLIC_SOCKET_URL_LOCAL || "http://newnextjs.web"
  : process.env.NEXT_PUBLIC_SOCKET_URL_PROD || "https://apilx.optigoapps.com";

const getSocketURL = (): string => API_SOCKET_BASE_URL;

export type SocketStatus = "connected" | "disconnected" | "error" | "connecting";

export interface SocketMessageData {
  [key: string]: unknown;
}

export interface SocketStoreData {
  userId: string;
  ufcc: string;
}

type Handler = (data: any) => void;
type Unsubscribe = () => void;

let socketInstance: Socket | null = null;
let isAuthenticated = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;

// unsubscribe function.
const messageReactionHandlers = new Set<Handler>();
const internalMessageHandlers = new Set<Handler>();
const internalStatusHandlers = new Set<Handler>();
const internalTypingHandlers = new Set<Handler>();
const sessionLogoutHandlers = new Set<Handler>();
const groupEventHandlers = new Set<Handler>();
const groupMemberHandlers = new Set<Handler>();
const groupPermissionHandlers = new Set<Handler>();
const internalMessageDeletionHandlers = new Set<Handler>();
const appVersionUpdateHandlers = new Set<Handler>();

const dispatch = (handlers: Set<Handler>, data: any, label?: string) => {
  handlers.forEach((handler) => {
    try {
      handler(data);
    } catch (error) {
      console.error(`❌ Error in ${label ?? "socket"} handler:`, error);
    }
  });
};

const dispatchReactionEvent = (data: any) =>
  dispatch(messageReactionHandlers, data, "reaction");

const dispatchAppVersionUpdate = (data: any) => {
  console.log("received internal:app_version_update", data);
  dispatch(appVersionUpdateHandlers, data, "app version update");
};

const dispatchGroupEvent = (data: any) =>
  dispatch(groupEventHandlers, data, "group event");

const dispatchGroupMemberEvent = (data: any) =>
  dispatch(groupMemberHandlers, data, "group member");

const dispatchGroupPermissionEvent = (data: any) =>
  dispatch(groupPermissionHandlers, data, "group permission");

const restoreConnection = () => {
  if (typeof window === "undefined") return;
  const savedState = sessionStorage.getItem("socketState");
  if (savedState) {
    try {
      const { token } = JSON.parse(savedState) as { token: string };
      if (token) {
        initializeSocket(token);
      }
    } catch (e) {
      console.error("Error restoring socket state:", e);
      sessionStorage.removeItem("socketState");
    }
  }
};

if (typeof window !== "undefined") {
  restoreConnection();
}

export function initializeSocket(token: string): Socket | null {
  if (typeof window === "undefined") return null;

  if (token) {
    sessionStorage.setItem("socketState", JSON.stringify({ token }));
  }

  if (socketInstance?.connected && isAuthenticated) {
    return socketInstance;
  }

  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
    isAuthenticated = false;
  }

  const socketURL = getSocketURL();

  socketInstance = io(socketURL, {
    auth: { token },
    reconnection: true,
  });

  socketInstance.on("connect", () => {
    isAuthenticated = true;
    reconnectAttempts = 0;
  });

  socketInstance.on("disconnect", () => {
    isAuthenticated = false;
  });

  socketInstance.on("connect_error", () => {
    isAuthenticated = false;
  });

  socketInstance.on("reconnect", () => {
    isAuthenticated = true;
  });

  socketInstance.on("reconnect_attempt", () => {
    // no-op (matches old app)
  });

  socketInstance.on("sessionLogout", (data: any) => {
    dispatch(sessionLogoutHandlers, data, "session logout");
  });

  // ── Message reactions ──────────────────────────────────────────────────
  socketInstance.on("internal:reaction_receive", dispatchReactionEvent);
  socketInstance.on("internal:reaction_send", dispatchReactionEvent);
  socketInstance.on("internal:reaction_remove_receive", dispatchReactionEvent);
  socketInstance.on("internal:reaction_remove", dispatchReactionEvent);

  // ── Messages ───────────────────────────────────────────────────────────
  socketInstance.on("internal:msg_receive", (data: any) => {
    dispatch(internalMessageHandlers, data, "message receive");
  });

  socketInstance.on("internal:msg_read", (data: any) => {
    dispatch(internalStatusHandlers, data, "message read");
  });

  socketInstance.on("internal:typing", (data: any) => {
    dispatch(internalTypingHandlers, data, "typing");
  });

  socketInstance.on("internal:delete_message", (data: any) => {
    dispatch(internalMessageDeletionHandlers, data, "message deletion");
  });

  // ── App version ────────────────────────────────────────────────────────
  socketInstance.on("internal:app_version_update", dispatchAppVersionUpdate);

  // ── Group events ───────────────────────────────────────────────────────
  socketInstance.on("internal:group_created", dispatchGroupEvent);
  socketInstance.on("internal:group_updated", dispatchGroupEvent);
  socketInstance.on("internal:group_deleted", dispatchGroupEvent);
  socketInstance.on("internal:member_added", dispatchGroupMemberEvent);
  socketInstance.on("internal:member_removed", dispatchGroupMemberEvent);
  socketInstance.on("internal:member_promoted", dispatchGroupMemberEvent);
  socketInstance.on("internal:member_demoted", dispatchGroupMemberEvent);
  socketInstance.on("internal:group_permission", dispatchGroupPermissionEvent);
  socketInstance.on("internal:group_info_request", dispatchGroupEvent);

  return socketInstance;
}

export const getSocket = (): Socket | null => socketInstance;

export const isSocketConnected = (): boolean => {
  const state = !!socketInstance?.connected && isAuthenticated;
  if (!state && !socketInstance) {
    const savedState = sessionStorage.getItem("socketState");
    if (savedState) {
      try {
        const { token } = JSON.parse(savedState) as { token: string };
        if (token && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
          reconnectAttempts++;
          initializeSocket(token);
        }
      } catch (e) {
        console.error("Error during reconnection attempt:", e);
      }
    }
  }
  return state;
};

export const isSocketAuthenticated = (): boolean => isAuthenticated;

export const addSessionLogoutHandler = (handler: Handler): Unsubscribe => {
  sessionLogoutHandlers.add(handler);
  return () => sessionLogoutHandlers.delete(handler);
};

export const addMessageReactionHandler = (handler: Handler): Unsubscribe => {
  messageReactionHandlers.add(handler);
  return () => messageReactionHandlers.delete(handler);
};

export const addInternalMessageHandler = (handler: Handler): Unsubscribe => {
  internalMessageHandlers.add(handler);
  return () => internalMessageHandlers.delete(handler);
};

export const addInternalStatusHandler = (handler: Handler): Unsubscribe => {
  internalStatusHandlers.add(handler);
  return () => internalStatusHandlers.delete(handler);
};

export const addInternalTypingHandler = (handler: Handler): Unsubscribe => {
  internalTypingHandlers.add(handler);
  return () => internalTypingHandlers.delete(handler);
};

export const addInternalMessageDeletionHandler = (handler: Handler): Unsubscribe => {
  internalMessageDeletionHandlers.add(handler);
  return () => internalMessageDeletionHandlers.delete(handler);
};

export const addAppVersionUpdateHandler = (handler: Handler): Unsubscribe => {
  appVersionUpdateHandlers.add(handler);
  return () => appVersionUpdateHandlers.delete(handler);
};

export const addGroupEventHandler = (handler: Handler): Unsubscribe => {
  groupEventHandlers.add(handler);
  return () => groupEventHandlers.delete(handler);
};

export const addGroupMemberHandler = (handler: Handler): Unsubscribe => {
  groupMemberHandlers.add(handler);
  return () => groupMemberHandlers.delete(handler);
};

export const addGroupPermissionHandler = (handler: Handler): Unsubscribe => {
  groupPermissionHandlers.add(handler);
  return () => groupPermissionHandlers.delete(handler);
};

export const emitInternalMessageSend = (payload: Record<string, unknown>): boolean => {
  if (!socketInstance) return false;
  socketInstance.emit("internal:msg_send", { ...payload, receiveEvent: "internal:msg_receive" });
  dispatch(internalMessageHandlers, payload, "local send");
  return true;
};

export const emitInternalMessageRead = (payload: Record<string, unknown>): boolean => {
  if (!socketInstance) return false;
  socketInstance.emit("internal:msg_read", { ...payload, receiveEvent: "internal:msg_read" });
  return true;
};

export const emitSendReaction = (payload: Record<string, unknown>): boolean => {
  if (!socketInstance) return false;
  socketInstance.emit("internal:reaction_send", { ...payload, receiveEvent: "internal:reaction_receive" });
  return true;
};

export const emitRemoveReaction = (payload: Record<string, unknown>): boolean => {
  if (!socketInstance) return false;
  socketInstance.emit("internal:reaction_remove", { ...payload, receiveEvent: "internal:reaction_remove_receive" });
  return true;
};

export const emitInternalStoreSocketData = (payload: SocketStoreData): boolean => {
  if (!socketInstance) return false;
  socketInstance.emit("internal.store_sockets", payload);
  return true;
};

export const emitGroupCreated = (payload: Record<string, unknown>): boolean => {
  if (!socketInstance) return false;
  socketInstance.emit("internal:group_created", { ...payload, receiveEvent: "internal:group_created" });
  return true;
};

export const emitGroupUpdated = (payload: Record<string, unknown>): boolean => {
  if (!socketInstance) return false;
  socketInstance.emit("internal:group_updated", { ...payload, receiveEvent: "internal:group_updated" });
  return true;
};

export const emitGroupDeleted = (payload: Record<string, unknown>): boolean => {
  if (!socketInstance) return false;
  socketInstance.emit("internal:group_deleted", { ...payload, receiveEvent: "internal:group_deleted" });
  return true;
};

export const emitMemberAdded = (payload: Record<string, unknown>): boolean => {
  if (!socketInstance) return false;
  socketInstance.emit("internal:member_added", { ...payload, receiveEvent: "internal:member_added" });
  return true;
};

export const emitMemberRemoved = (payload: Record<string, unknown>): boolean => {
  if (!socketInstance) return false;
  socketInstance.emit("internal:member_removed", { ...payload, receiveEvent: "internal:member_removed" });
  return true;
};

export const emitMemberPromoted = (payload: Record<string, unknown>): boolean => {
  if (!socketInstance) return false;
  socketInstance.emit("internal:member_promoted", { ...payload, receiveEvent: "internal:member_promoted" });
  return true;
};

export const emitMemberDemoted = (payload: Record<string, unknown>): boolean => {
  if (!socketInstance) return false;
  socketInstance.emit("internal:member_demoted", { ...payload, receiveEvent: "internal:member_demoted" });
  return true;
};

export const emitPermissionChanged = (payload: Record<string, unknown>): boolean => {
  if (!socketInstance) return false;
  socketInstance.emit("internal:group_permission", { ...payload, receiveEvent: "internal:group_permission" });
  return true;
};

export const emitInternalTyping = (payload: Record<string, unknown>): boolean => {
  if (!socketInstance) return false;
  socketInstance.emit("internal:typing", { ...payload, receiveEvent: "internal:typing" });
  return true;
};

export const emitInternalMessageDelete = (payload: Record<string, unknown>): boolean => {
  if (!socketInstance) return false;
  socketInstance.emit("internal:delete_message", { ...payload, receiveEvent: "internal:delete_message" });
  dispatch(internalMessageDeletionHandlers, payload, "local delete");
  return true;
};

export const emitAppVersionUpdate = (payload: Record<string, unknown> = {}): boolean => {
  if (!socketInstance) return false;
  const versionData = {
    version: getAppVersion(),
    receiveEvent: "internal:app_version_update",
    ...payload,
  };
  socketInstance.emit("internal:app_version_update", versionData);
  dispatchAppVersionUpdate(versionData);
  return true;
};

export const emitGroupInfoRequest = (payload: Record<string, unknown>): boolean => {
  if (!socketInstance) return false;
  socketInstance.emit("internal:group_info_request", { ...payload, receiveEvent: "internal:group_info_request" });
  return true;
};

export const disconnectSocket = (permanent = false): void => {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
    isAuthenticated = false;
    sessionLogoutHandlers.clear();
    messageReactionHandlers.clear();
    internalMessageHandlers.clear();
    internalStatusHandlers.clear();
    internalTypingHandlers.clear();
    internalMessageDeletionHandlers.clear();
    appVersionUpdateHandlers.clear();
    groupEventHandlers.clear();
    groupMemberHandlers.clear();
    groupPermissionHandlers.clear();
  }
  if (permanent) {
    sessionStorage.removeItem("socketState");
  }
};

function getAppVersion(): string {
  try {
    return localStorage.getItem("app_version_current") || "0.0.0";
  } catch {
    return "0.0.0";
  }
}
