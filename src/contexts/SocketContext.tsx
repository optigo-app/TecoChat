"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react";
import { useRouter } from "next/navigation";
import {
  initializeSocket,
  disconnectSocket,
  isSocketConnected,
  addSessionLogoutHandler,
  emitInternalStoreSocketData,
  type SocketStatus,
} from "../socket";
import { useLoginContext } from "./LoginData";
import { eraseCookie } from "../utils/cookieUtils";
import { deleteDb } from "../db/tecoDb";

interface SocketContextValue {
  /** Current socket connection status. */
  status: SocketStatus;
  /** True when the socket is connected and authenticated. */
  isConnected: boolean;
  /** Socket ID (available after connect). */
  socketId: string | null;
}

const SocketContext = createContext<SocketContextValue>({
  status: "disconnected",
  isConnected: false,
  socketId: null,
});

export const useSocketContext = (): SocketContextValue => useContext(SocketContext);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { auth } = useLoginContext();
  const router = useRouter();
  const [status, setStatus] = useState<SocketStatus>("disconnected");
  const [socketId, setSocketId] = useState<string | null>(null);

  // Refs to avoid reconnecting on every auth change
  const authRef = useRef(auth);
  const routerRef = useRef(router);

  useEffect(() => {
    authRef.current = auth;
  }, [auth]);

  useEffect(() => {
    routerRef.current = router;
  }, [router]);

  // ── Session logout handler ──────────────────────────────────────────────
  // When the server sends "sessionLogout", clear everything and redirect.
  const handleSessionLogout = useCallback(() => {
    // Wipe the per-user IndexedDB before clearing sessionStorage.
    deleteDb(authRef.current?.id).catch(() => {});
    sessionStorage.clear();
    eraseCookie("userData");
    eraseCookie("token");
    eraseCookie("remembered_creds");
    disconnectSocket(true);
    setStatus("disconnected");
    setSocketId(null);
    routerRef.current.replace("/login");
  }, []);

  // ── Socket initialization ───────────────────────────────────────────────
  useEffect(() => {
    let isMounted = true;
    let cleanup: (() => void) | null = null;

    const checkAndInitialize = async () => {
      let token = authRef.current?.token;
      let userId = authRef.current?.userId;

      // Fall back to sessionStorage if auth context isn't populated yet
      if (!token || !userId) {
        const isLoggedIn = sessionStorage.getItem("isLoggedIn");
        const userDataStr = sessionStorage.getItem("userData");
        if (isLoggedIn && userDataStr) {
          try {
            const userData = JSON.parse(userDataStr);
            token = token || userData?.token;
            userId = userId || userData?.userId || userData?.id;
          } catch {
            /* ignore */
          }
        }
      }

      if (!token || !userId) return;

      try {
        const socket = initializeSocket(token);
        if (!socket) return;

        const onConnect = () => {
          if (!isMounted) return;
          console.log("✅ Socket connected:", socket.id);
          setSocketId(socket.id ?? null);
          setStatus("connected");

          // Register socket ID with the server (emit store socket data)
          const currentAuth = authRef.current;
          if (currentAuth?.id && currentAuth?.ufcc) {
            emitInternalStoreSocketData({
              userId: currentAuth.id,
              ufcc: currentAuth.ufcc,
            });
          }
        };

        const onDisconnect = (reason: string) => {
          if (!isMounted) return;
          console.warn("⚠️ Socket disconnected:", reason);
          setStatus("disconnected");
          setSocketId(null);
          // If server is unreachable (transport close / io server disconnect),
          // show service-down UI
          if (reason === "io server disconnect" || reason === "transport close") {
            window.dispatchEvent(
              new CustomEvent("SERVICE_DOWN", {
                detail: { message: "Connection lost. The server may be temporarily unavailable." },
              })
            );
          }
        };

        const onConnectError = (err: Error & { description?: unknown; context?: unknown }) => {
          if (!isMounted) return;
          console.error("❌ Socket connection error:", err.message);
          setStatus("error");
          setSocketId(null);

          // Check for 502 Bad Gateway or server unreachable
          const desc = err.description as { status?: number; statusCode?: number } | undefined;
          const status = desc?.status ?? desc?.statusCode;
          const is502 = status === 502 || err.message.includes("502") || err.message.includes("Bad Gateway");
          const isServerDown = err.message.includes("xhr poll error") || err.message.includes("transport close");

          if (is502 || isServerDown) {
            window.dispatchEvent(
              new CustomEvent("SERVICE_DOWN", {
                detail: {
                  message: is502
                    ? "Server is temporarily unavailable (502 Bad Gateway). Please try again shortly."
                    : "Cannot connect to the server. Please check your connection.",
                },
              })
            );
          }
        };

        socket.on("connect", onConnect);
        socket.on("disconnect", onDisconnect);
        socket.on("connect_error", onConnectError);

        // When socket reconnects, dismiss service-down UI
        socket.io.on("reconnect", () => {
          if (!isMounted) return;
          window.dispatchEvent(new CustomEvent("SERVICE_UP"));
        });

        // Register session logout handler
        const unsubSessionLogout = addSessionLogoutHandler(handleSessionLogout);

        // If socket is already connected (e.g. restored from sessionStorage),
        // fire onConnect immediately.
        if (socket.connected) {
          onConnect();
        }

        // Periodic connection status check (every 5s — matches old app)
        const interval = setInterval(() => {
          if (!isMounted) return;
          const connected = isSocketConnected();
          setStatus(connected ? "connected" : "disconnected");
          if (connected && socket.id) {
            setSocketId(socket.id ?? null);
          } else if (!connected) {
            setSocketId(null);
          }
        }, 5000);

        cleanup = () => {
          clearInterval(interval);
          socket.off("connect", onConnect);
          socket.off("disconnect", onDisconnect);
          socket.off("connect_error", onConnectError);
          socket.io.off("reconnect");
          unsubSessionLogout();
        };
      } catch (err) {
        console.error("Socket initialization error:", err);
      }
    };

    checkAndInitialize();

    return () => {
      isMounted = false;
      if (cleanup) cleanup();
    };
    // Only re-run when auth.token changes (not on every auth field update)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth?.token, handleSessionLogout]);

  const value: SocketContextValue = {
    status,
    isConnected: status === "connected",
    socketId,
  };

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
};
