"use client";

import React, { useRef, useState, useEffect } from "react";
import "./LoginPageV2.scss";
import { toast } from "react-hot-toast";
import { useRouter } from "next/navigation";
import { fetchLoginApi } from "../../API/LoginAPI/LoginAPI";
import { getToken } from "../../API/GetToken/GetToken";
import { setCookie, eraseCookie, getCookie } from "../../utils/cookieUtils";
import { useLoginContext } from "../../contexts/LoginData";
import { initializeSocket } from "../../socket";
import { Eye, EyeOff, Check, ArrowLeft, Loader2 } from "lucide-react";
import Image from "next/image";
import logo from "@/src/assets/logo.png";

const LoginPageV2 = () => {
  const router = useRouter();
  const { setAuth, token, setToken } = useLoginContext();

  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [step, setStep] = useState<"company" | "signin">("company");
  const [credentials, setCredentials] = useState({
    companycode: "",
    userId: "",
    password: "",
  });
  const [rememberMe, setRememberMe] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [companyVerified, setCompanyVerified] = useState(false);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const companyCodeRef = useRef<HTMLInputElement>(null);
  const userIdRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  // Auto-hide form error after 4 seconds
  const showFormError = (msg: string) => {
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    setFormError(msg);
    if (msg) {
      errorTimerRef.current = setTimeout(() => setFormError(""), 4000);
    }
  };

  useEffect(() => {
    return () => {
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    };
  }, []);

  // Load remembered credentials
  useEffect(() => {
    const localCC = localStorage.getItem("remembered_companycode");
    const localUI = localStorage.getItem("remembered_userId");
    const savedCreds = getCookie("remembered_creds");

    if (localCC || localUI) {
      setCredentials((prev) => ({
        ...prev,
        companycode: localCC || "",
        userId: localUI || "",
      }));
      setRememberMe(true);

      if (localCC) {
        getToken(localCC).then((tokenData) => {
          if (tokenData?.rd?.[0]?.stat === 1) {
            const tData = tokenData.rd[0];
            setToken({ sv: tData.sv.toString(), yc: tData.yc || "" });
            sessionStorage.setItem("token", JSON.stringify(tData));
            setCompanyVerified(true);
            setStep("signin");
          }
        }).catch(() => {});

        if (localCC && localUI) {
          setTimeout(() => passwordRef.current?.focus?.(), 200);
        }
      }
    } else if (savedCreds) {
      try {
        const parsed = JSON.parse(savedCreds);
        setCredentials((prev) => ({
          ...prev,
          companycode: parsed.companycode || "",
          userId: parsed.userId || "",
        }));
        setRememberMe(true);

        if (parsed.companycode) {
          getToken(parsed.companycode).then((tokenData) => {
            if (tokenData?.rd?.[0]?.stat === 1) {
              const tData = tokenData.rd[0];
              setToken({ sv: tData.sv.toString(), yc: tData.yc || "" });
              sessionStorage.setItem("token", JSON.stringify(tData));
              setCompanyVerified(true);
              setStep("signin");
            }
          });
        }

        if (parsed.companycode && parsed.userId) {
          setTimeout(() => passwordRef.current?.focus?.(), 200);
        }
      } catch {
        // ignore
      }
    }
  }, [setToken]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setCredentials((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: "" }));
    if (formError) showFormError("");
    if (name === "companycode") {
      setCompanyVerified(false);
      if (!value.trim()) {
        setToken({ sv: "", yc: "" });
        sessionStorage.removeItem("token");
      }
    }
  };

  const handleCompanyCodeBlur = async (): Promise<boolean> => {
    if (!credentials.companycode.trim()) return false;
    setIsVerifying(true);
    try {
      const tokenData = await getToken(credentials.companycode.trim());
      if (!tokenData || !tokenData?.rd?.[0]) {
        setErrors((prev) => ({ ...prev, companycode: "Invalid company code" }));
        setToken({ sv: "", yc: "" });
        setCompanyVerified(false);
        return false;
      }
      if (tokenData?.rd?.[0]?.stat === 0) {
        setErrors((prev) => ({ ...prev, companycode: "Invalid company code" }));
        setToken({ sv: "", yc: "" });
        setCompanyVerified(false);
        return false;
      } else if (tokenData?.rd?.[0]?.stat === 1) {
        const tData = tokenData.rd[0];
        setToken({ sv: tData.sv.toString(), yc: tData.yc || "" });
        sessionStorage.setItem("token", JSON.stringify(tData));
        setCompanyVerified(true);
        return true;
      }
      setErrors((prev) => ({ ...prev, companycode: "Unable to verify company code" }));
      setCompanyVerified(false);
      return false;
    } catch {
      setErrors((prev) => ({ ...prev, companycode: "Error validating company code" }));
      setCompanyVerified(false);
      return false;
    } finally {
      setIsVerifying(false);
    }
  };

  const handleCompanySubmit = async (e?: React.FormEvent | React.KeyboardEvent) => {
    e?.preventDefault?.();
    if (!credentials.companycode.trim()) {
      setErrors((prev) => ({ ...prev, companycode: "Company code is required" }));
      return;
    }
    const ok = await handleCompanyCodeBlur();
    if (ok) {
      setStep("signin");
      setTimeout(() => userIdRef.current?.focus?.(), 200);
    }
  };

  const handleSignInSubmit = async (e?: React.FormEvent | React.KeyboardEvent) => {
    e?.preventDefault?.();
    setIsLoading(true);
    showFormError("");

    if (!credentials.userId.trim()) {
      setErrors((prev) => ({ ...prev, userId: "User ID is required" }));
      setIsLoading(false);
      return;
    }
    if (!credentials.password.trim()) {
      setErrors((prev) => ({ ...prev, password: "Password is required" }));
      setIsLoading(false);
      return;
    }

    if (credentials.companycode.trim() && (!token?.sv || !token?.yc)) {
      const ok = await handleCompanyCodeBlur();
      if (!ok) {
        setStep("company");
        companyCodeRef.current?.focus?.();
        setIsLoading(false);
        return;
      }
    }

    try {
      const loginData = await fetchLoginApi(credentials);
      const userInfo = loginData?.rd?.[0];
      if (userInfo?.stat !== 1) {
        showFormError("Invalid credentials");
        toast.error("Invalid credentials");
        setIsLoading(false);
        return;
      }

      initializeSocket(userInfo.token);
      const username = [userInfo.firstname, userInfo.middlename, userInfo.lastname]
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

      // Persist session data and set auth immediately — SocketContext
      // owns the socket "connect" event and will emitInternalStoreSocketData
      // when the connection is established.
      sessionStorage.setItem("userData", JSON.stringify(userData));
      sessionStorage.setItem("isLoggedIn", "true");

      if (rememberMe) {
        localStorage.setItem("remembered_companycode", credentials.companycode);
        localStorage.setItem("remembered_userId", credentials.userId);
        setCookie("userData", userData, 15);
        setCookie("token", token, 15);
        setCookie("remembered_creds", {
          companycode: credentials.companycode,
          userId: credentials.userId,
        }, 15);
      } else {
        eraseCookie("userData");
        eraseCookie("token");
        eraseCookie("remembered_creds");
      }

      setAuth(userData);
      showFormError("");
      toast.success("Login successful! Welcome back!", { icon: "🎉" });
      router.replace("/");
    } catch {
      showFormError("Login failed. Please try again.");
      toast.error("Login failed. Please try again.");
      setIsLoading(false);
    } finally {
      setIsLoading(false);
    }
  };

  const goBackToCompany = () => {
    setStep("company");
    setCompanyVerified(false);
    setCredentials((prev) => ({ ...prev, companycode: "" }));
    setErrors({});
    showFormError("");
    setTimeout(() => companyCodeRef.current?.focus?.(), 200);
  };

  return (
    <div className="loginv2-container">
      <div className="loginv2-card">
        {/* ─── Left Brand Panel — image only, theme-aware ─── */}
        <div className="loginv2-brand">
          {/* Both images rendered; CSS toggles visibility via data-theme on <html>.
              This avoids a hydration flash from next/image swapping src. */}
          <Image
            src="/login/login-mockup-light.webp"
            alt="Tecochat mobile chat preview"
            fill
            className="brand-mockup brand-mockup-light"
            priority
            sizes="(max-width: 768px) 0px, 50vw"
          />
          <Image
            src="/login/login-mockup-dark.webp"
            alt="Tecochat mobile chat preview"
            fill
            className="brand-mockup brand-mockup-dark"
            priority
            sizes="(max-width: 768px) 0px, 50vw"
          />
        </div>

        {/* ─── Right Form Panel ─── */}
        <div className="loginv2-form-panel">
          {/* Logo — same as sidebar */}
          <div className="loginv2-logo-row">
            <div className="loginv2-logo">
              <div className="icon-bg">
                <Image
                  src={logo}
                  alt="TeCoChat"
                  fill
                  className="icon"
                  draggable={false}
                  priority
                  sizes="40px"
                />
              </div>
              <span className="logo-text">TeCoChat</span>
            </div>
          </div>

          {/* Form content */}
          <div className="loginv2-form-content">
            {step === "company" ? (
              <>
                <h2 className="loginv2-form-title">Company Code</h2>
                <p className="loginv2-form-subtitle">
                  Enter your company code to continue
                </p>

                {formError && <div className="loginv2-form-error">{formError}</div>}

                <form onSubmit={handleCompanySubmit}>
                  <div className="loginv2-field">
                    <label className="loginv2-field-label" htmlFor="companycode">
                      Company Code
                    </label>
                    <div className="loginv2-input-wrapper">
                      <input
                        id="companycode"
                        name="companycode"
                        type="text"
                        ref={companyCodeRef}
                        className={`loginv2-input has-adornment ${
                          errors.companycode ? "is-error" : ""
                        }`}
                        placeholder="e.g. orail25"
                        value={credentials.companycode}
                        onChange={handleChange}
                        onBlur={handleCompanyCodeBlur}
                        onKeyDown={(e) => {
                          if (e.key !== "Enter") return;
                          e.preventDefault();
                          handleCompanySubmit(e);
                        }}
                        autoComplete="organization"
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                      />
                      {companyVerified && (
                        <span className="loginv2-check-icon">
                          <Check size={20} />
                        </span>
                      )}
                    </div>
                    {errors.companycode && (
                      <div className="loginv2-error-text">{errors.companycode}</div>
                    )}
                  </div>

                  <button
                    type="submit"
                    className="loginv2-submit-btn"
                    disabled={isVerifying}
                  >
                    {isVerifying ? (
                      <>
                        <Loader2 size={18} className="loginv2-spinner" />
                        Verifying...
                      </>
                    ) : (
                      "Continue"
                    )}
                  </button>
                </form>
              </>
            ) : (
              <>
                <h2 className="loginv2-form-title">Sign In</h2>
                <p className="loginv2-form-subtitle">
                  Welcome back! Enter your credentials.
                </p>

                {formError && <div className="loginv2-form-error">{formError}</div>}

                <form onSubmit={handleSignInSubmit}>
                  {/* User ID */}
                  <div className="loginv2-field">
                    <label className="loginv2-field-label" htmlFor="userId">
                      User Id
                    </label>
                    <div className="loginv2-input-wrapper">
                      <input
                        id="userId"
                        name="userId"
                        type="text"
                        ref={userIdRef}
                        className={`loginv2-input ${
                          errors.userId ? "is-error" : ""
                        }`}
                        placeholder="Email or Username"
                        value={credentials.userId}
                        onChange={handleChange}
                        onKeyDown={(e) => {
                          if (e.key !== "Enter") return;
                          e.preventDefault();
                          const userId = credentials.userId.trim();
                          if (!userId) {
                            setErrors((prev) => ({ ...prev, userId: "User ID is required" }));
                            return;
                          }
                          if (credentials.password.trim()) {
                            handleSignInSubmit(e);
                            return;
                          }
                          passwordRef.current?.focus?.();
                        }}
                        autoComplete="username"
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                      />
                    </div>
                    {errors.userId && (
                      <div className="loginv2-error-text">{errors.userId}</div>
                    )}
                  </div>

                  {/* Password */}
                  <div className="loginv2-field">
                    <label className="loginv2-field-label" htmlFor="password">
                      Password
                    </label>
                    <div className="loginv2-input-wrapper">
                      <input
                        id="password"
                        name="password"
                        type={showPassword ? "text" : "password"}
                        ref={passwordRef}
                        className={`loginv2-input has-adornment ${
                          errors.password ? "is-error" : ""
                        }`}
                        placeholder="Password"
                        value={credentials.password}
                        onChange={handleChange}
                        onKeyDown={(e) => {
                          if (e.key !== "Enter") return;
                          e.preventDefault();
                          handleSignInSubmit(e);
                        }}
                        autoComplete="current-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="loginv2-eye-toggle"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                    {errors.password && (
                      <div className="loginv2-error-text">{errors.password}</div>
                    )}
                  </div>

                  {/* Remember me + back */}
                  <div className="loginv2-options-row">
                    <label className="loginv2-remember">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                      />
                      <span className="remember-label">Remember me</span>
                    </label>
                    <button
                      type="button"
                      onClick={goBackToCompany}
                      className="loginv2-back-link"
                    >
                      <ArrowLeft size={14} /> Change company
                    </button>
                  </div>

                  <button
                    type="submit"
                    className="loginv2-submit-btn"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 size={18} className="loginv2-spinner" />
                        Signing in...
                      </>
                    ) : (
                      "Sign In"
                    )}
                  </button>
                </form>
              </>
            )}
          </div>

          {/* Footer — same as sidebar */}
          <div className="loginv2-footer">
            <span>Powered by </span>
            <div className="optigo-logo">
              <Image
                src="/icons/brand/brandlogolight.png"
                alt="Optigo logo"
                width={80}
                height={42}
                draggable={false}
                className="optigo-logo-light"
              />
              <Image
                src="/icons/brand/brandlogodark.svg"
                alt="Optigo logo"
                width={80}
                height={42}
                draggable={false}
                className="optigo-logo-dark"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPageV2;
