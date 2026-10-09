"use client";

import React, { useLayoutEffect, useState } from "react";
import { useRouter } from "next/navigation";
import PreHydrationLoader from "./PreHydrationLoader/PreHydrationLoaderAnimation";
import { useLoginContext } from "../contexts/LoginData";
import { disconnectSocket } from "../socket";

// Client-side auth gate:
//   - If not logged in (no userId + token/ukey), redirect to /login.
//   - Shows a loader while the session is being verified.
//   - Forced logout via the socket "sessionLogout" event is handled by
//     SocketContext, which clears storage and redirects to /login.
export const AuthGuard = ({ children }: { children: React.ReactNode }) => {
  const router = useRouter();
  const { auth } = useLoginContext();
  // Always start true to match server render (sessionStorage is not available on server).
  // The effect below immediately sets it to false if auth is already available,
  // so the loader only flashes for one frame on the client.
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  // Session check — useLayoutEffect runs before paint so the loader
  // never flashes for already-authenticated users
  useLayoutEffect(() => {
    const isLoggedIn = auth?.userId && (auth?.token || auth?.ukey);

    if (!isLoggedIn) {
      disconnectSocket(true);
      router.replace("/login");
    }
    setIsCheckingSession(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth?.userId, auth?.token, auth?.ukey]);

  if (isCheckingSession) {
    return <PreHydrationLoader show={true} text="Checking your session…" />;
  }

  return <>{children}</>;
};
