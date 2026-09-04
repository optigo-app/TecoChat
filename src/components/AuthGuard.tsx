"use client";

import React, { useEffect, useLayoutEffect, useState, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Box } from "@mui/material";
import loader from "../assets/lotties/loader.json";
import { useLoginContext } from "../context/LoginData";
import { disconnectSocket, isSocketConnected } from "../socket";
import { eraseCookie } from "../utils/cookieUtils";

// Lazy-load Lottie — only needed briefly during session check
const Lottie = dynamic(() => import("lottie-react"), { ssr: false });

// Mirrors the session-check logic from the old App.js:
//   - If not logged in (no userId + token/ukey), redirect to /login
//     (or /session-check if a socket id was previously stored).
//   - Shows a loader while the session is being verified.
//   - Listens for the socket "sessionLogout" event to force a logout.
//
// The real socket.io wiring will be added in a later step; for now this
// component handles the client-side auth gate.
export const AuthGuard = ({ children }: { children: React.ReactNode }) => {
  const router = useRouter();
  const { auth, setAuth, setToken } = useLoginContext();
  // Always start true to match server render (sessionStorage is not available on server).
  // The effect below immediately sets it to false if auth is already available,
  // so the loader only flashes for one frame on the client.
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  const navigateRef = useRef(router);
  useEffect(() => {
    navigateRef.current = router;
  }, [router]);

  // Stable session-logout callback
  const handleSessionLogout = useCallback(() => {
    console.log("🔒 Session logout received");

    sessionStorage.clear();

    // Clear cookies that cause auto-login
    eraseCookie("userData");
    eraseCookie("token");

    // Clear context state to force a full re-render/redirect
    setAuth({ userId: "", username: "", ukey: "", token: "", id: "", ufcc: "" });
    setToken({ sv: "", yc: "" });

    disconnectSocket(true);
    navigateRef.current.replace("/login");
  }, [setAuth, setToken]);

  // Session check — useLayoutEffect runs before paint so the loader
  // never flashes for already-authenticated users
  useLayoutEffect(() => {
    const checkSession = () => {
      const isLoggedIn = auth?.userId && (auth?.token || auth?.ukey);
      const hasExistingSocket = sessionStorage.getItem("hasSocketId");

      if (!isLoggedIn) {
        if (hasExistingSocket) {
          router.replace("/session-check");
        } else {
          disconnectSocket(true);
          router.replace("/login");
        }
      }
      setIsCheckingSession(false);
    };

    checkSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth?.userId, auth?.token, auth?.ukey]);

  if (isCheckingSession) {
    return (
      <Box
        sx={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "transparent",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          zIndex: 10000,
          pointerEvents: "none",
        }}
      >
        <Box sx={{ width: 120, height: 120, opacity: 0.8 }}>
          <Lottie animationData={loader} loop={true} />
        </Box>
      </Box>
    );
  }

  return <>{children}</>;
};
