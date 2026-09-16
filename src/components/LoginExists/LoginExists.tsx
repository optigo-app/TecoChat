"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useLoginContext } from "../../contexts/LoginData";
import "./LoginExists.scss";
import warning from "../../assets/lotties/warning.json";
import loader from "../../assets/lotties/loader.json";
import { initializeSocket } from "../../socket";
import { Button } from "@mui/material";
import { eraseCookie } from "../../utils/cookieUtils";

// Lazy-load Lottie — only shown on the "already logged in" page
const Lottie = dynamic(() => import("lottie-react"), { ssr: false });

interface StoredSocketId {
  id?: string;
  userId?: string;
  username?: string;
  ukey?: string;
  token?: string;
  ufcc?: string;
  designation?: string;
  [key: string]: unknown;
}

const LoginExists = () => {
  const { setAuth } = useLoginContext();
  const [loading, setLoading] = useState(false);
  const [getId] = useState<StoredSocketId | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      return JSON.parse(sessionStorage.getItem("hasSocketId") || "null");
    } catch {
      return null;
    }
  });
  const router = useRouter();

  const handleStayLoggedIn = async () => {
    try {
      setLoading(true);
      const socket = initializeSocket(getId?.token ?? "");

      setAuth({
        userId: getId?.userId ?? "",
        username: getId?.username ?? "",
        ukey: getId?.ukey ?? "",
        token: getId?.token ?? "",
        id: getId?.id ?? "",
        ufcc: getId?.ufcc ?? "",
        SocketId: socket?.id || "",
      });

      sessionStorage.setItem("isLoggedIn", "true");
      sessionStorage.setItem("userData", JSON.stringify(getId));
      sessionStorage.removeItem("hasSocketId");
      router.replace("/");
    } catch (error) {
      console.error("Error staying logged in:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      setLoading(true);
      sessionStorage.clear();
      eraseCookie("userData");
      eraseCookie("token");
      router.replace("/login");
    } catch (error) {
      console.error("Error logging out:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="session-wrapper">
      {/* Loader Overlay */}
      {loading && (
        <div className="loader-overlay">
          <div className="lottie-container">
            <Lottie
              animationData={loader}
              loop={true}
              style={{ width: "100%", height: "100%", pointerEvents: "none" }}
            />
          </div>
        </div>
      )}

      <div className="session-right">
        <div className="session-card">
          <div className="logo">
            <Lottie
              animationData={warning}
              loop={true}
              style={{ width: "50%", height: "50%", pointerEvents: "none" }}
            />
          </div>
          <div className="message">
            You are already logged in on another device.
          </div>
          <div className="buttons">
            <Button
              className="btn stay"
              onClick={handleLogout}
              disabled={loading}
            >
              Stay Logged In
            </Button>
            <Button
              className="btn logout"
              onClick={handleStayLoggedIn}
              disabled={loading}
            >
              Logout other sessions
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginExists;
