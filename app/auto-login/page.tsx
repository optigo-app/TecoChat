"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Box, Typography } from "@mui/material";
import Lottie from "lottie-react";
import { toast } from "react-hot-toast";
import loader from "@/src/assets/lotties/loader.json";
import { useLoginContext } from "@/src/context/LoginData";
import {
  fetchAutoLoginApi,
  AutoLoginData,
} from "@/src/API/AutoLogin/AutoLogin";
import { initializeSocket, emitInternalStoreSocketData } from "@/src/socket";

const decodeAutoLoginData = (raw: string): AutoLoginData | null => {
  try {
    const decoded = atob(raw);
    const parsed = JSON.parse(decoded);
    // Support both new format (ufcc, userEmail) and legacy format (uid, yc)
    const ufcc = parsed?.ufcc ?? parsed?.companycode ?? "";
    const userEmail = parsed?.userEmail ?? parsed?.uid ?? parsed?.email ?? "";
    const yearcode = parsed?.yc ?? parsed?.yearcode ?? "";
    if (!ufcc || !userEmail) return null;
    return { ufcc, userEmail, yearcode, sv: parsed?.sv };
  } catch {
    return null;
  }
};

export default function AutoLoginPage() {
  const router = useRouter();
  const { setAuth, setToken } = useLoginContext();
  const [status, setStatus] = useState("Logging in...");
  const hasRun = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined" || hasRun.current) return;
    hasRun.current = true;

    const params = new URLSearchParams(window.location.search);
    const raw = params.get("data") || params.get("auto-login");

    if (!raw) {
      toast.error("Missing auto-login data");
      router.replace("/login");
      return;
    }

    const data = decodeAutoLoginData(raw);
    if (!data) {
      toast.error("Invalid auto-login data");
      router.replace("/login");
      return;
    }

    let cancelled = false;

    const onSuccess = (userData: any) => {
      if (cancelled) return;
      setAuth(userData);
      toast.success("Login successful");
      router.replace("/");
    };

    const onError = (message: string) => {
      if (cancelled) return;
      setStatus("Login failed");
      toast.error(message);
      router.replace("/login");
    };

    fetchAutoLoginApi(data)
      .then((loginData) => {
        if (cancelled) return;
        const userInfo = loginData?.Data?.rd?.[0];
        if (userInfo?.stat !== 1) {
          onError(userInfo?.msg || "Auto-login failed");
          return;
        }

        const username = [
          userInfo.firstname,
          userInfo.middlename,
          userInfo.lastname,
        ]
          .filter(Boolean)
          .join(" ");

        const userData = {
          ...userInfo,
          userId: userInfo.userid,
          username,
          ukey: userInfo.ukey,
          token: userInfo.token,
          id: userInfo.id,
          SocketId: userInfo.SocketId || "",
          ufcc: userInfo.companycode ?? "",
        };

        const tokenData = {
          sv: userInfo.svid
            ? userInfo.svid.toString()
            : data.sv !== undefined
            ? String(data.sv)
            : "",
          yc: userInfo.yearcode || data.yearcode || "",
        };

        setToken(tokenData);
        sessionStorage.setItem("token", JSON.stringify(tokenData));
        sessionStorage.setItem("userData", JSON.stringify(userData));
        sessionStorage.setItem("isLoggedIn", "true");

        const socket = initializeSocket(userInfo.token);
        if (!socket) {
          onError("Socket initialization failed");
          return;
        }

        const store = () => {
          emitInternalStoreSocketData({
            userId: userData.id ?? "",
            ufcc: userData.ufcc ?? "",
          });
          onSuccess(userData);
        };

        if (socket.connected) {
          store();
        } else {
          socket.on("connect", store);
          socket.on("connect_error", (err: { message?: string }) => {
            onError(err.message || "Socket connection failed");
          });
        }
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("Auto-login error:", err);
        onError("Auto-login failed");
      });

    return () => {
      cancelled = true;
    };
  }, [router, setAuth, setToken]);

  return (
    <Box
      sx={{
        position: "fixed",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "var(--color-surface)",
        zIndex: 10000,
      }}
    >
      <Box sx={{ width: 150, height: 150 }}>
        <Lottie animationData={loader} loop={true} />
      </Box>
      <Typography
        sx={{
          mt: 2,
          color: "var(--color-text)",
          fontSize: "1rem",
          fontWeight: 500,
        }}
      >
        {status}
      </Typography>
    </Box>
  );
}
