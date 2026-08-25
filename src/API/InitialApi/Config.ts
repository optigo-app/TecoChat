// ── Env helpers ──────────────────────────────────────────────────────────────
// All URLs and config values come from .env (NEXT_PUBLIC_*).
// IMPORTANT: Next.js only inlines NEXT_PUBLIC_* vars when accessed with a
// LITERAL key (e.g. process.env.NEXT_PUBLIC_API_URL_LOCAL). Dynamic access
// like process.env[key] is NOT inlined and returns undefined in the browser.
// Falls back to sensible defaults if an env var is missing.

const LOCAL_HOSTS = (process.env.NEXT_PUBLIC_LOCAL_HOSTS || "localhost,nzen,tecochat.web,web")
  .split(",")
  .map((h) => h.trim())
  .filter(Boolean);

const getIsLocal = (): boolean => {
  if (typeof window === "undefined") return false;
  return LOCAL_HOSTS.includes(window.location.hostname);
};

const getApiBaseUrl = (): string => {
  return getIsLocal()
    ? process.env.NEXT_PUBLIC_API_URL_LOCAL || "http://newnextjs.web/api"
    : process.env.NEXT_PUBLIC_API_URL_PROD || "https://apilx.optigoapps.com/api";
};

// Media
export const UPLOAD_URL = () => `${getApiBaseUrl()}/upload`;
export const REMOVE_FILE_URL = () => `${getApiBaseUrl()}/removefile`;

// WhatsApp APIs
export const LOGOUTAPI = () => `${getApiBaseUrl()}/whatsapp/chat/logout`;

// Report / Common APIs
export const APIURL = () => `${getApiBaseUrl()}/report`;
export const GETCONVERSATIONURL = () => `${getApiBaseUrl()}/report`;
export const SAVEPLAYERID = () => `${getApiBaseUrl()}/report`;

// file Download APIs
export const DOWNLOAD_FILE_URL = () => `${getApiBaseUrl()}/downloadfile`;

interface ApiCredentials {
  yc?: string;
  sv?: string;
}

export const getApiHeaders = (): Record<string, string> => {
  let credentials: ApiCredentials | null = null;

  if (typeof window !== "undefined") {
    try {
      const sessionToken = sessionStorage.getItem("token");
      const userData = sessionStorage.getItem("userData");
      const parsedToken = sessionToken ? JSON.parse(sessionToken) : null;
      const parsedUser = userData ? JSON.parse(userData) : null;

      if (parsedToken || parsedUser) {
        credentials = {
          yc: (parsedToken && parsedToken.yc) ?? (parsedUser && parsedUser.yearcode),
          sv: (parsedToken && parsedToken.sv) ?? (parsedUser && parsedUser.svid),
        };
      }
    } catch {
      // ignore parse errors
    }
  }

  const headers: Record<string, string> = {
    Version: getIsLocal()
      ? process.env.NEXT_PUBLIC_VERSION_LOCAL || "R50B3"
      : process.env.NEXT_PUBLIC_VERSION_PROD || "R75PRO",
    sp: process.env.NEXT_PUBLIC_SP || "80",
  };

  if (credentials && credentials.yc) {
    headers["Yearcode"] = credentials.yc;
  }

  if (credentials && credentials.sv) {
    headers["sv"] = credentials.sv;
  }

  return headers;
};

export const getHeaders = (): Record<string, string> => getApiHeaders();
export const getLoginHeaders = (): Record<string, string> => getApiHeaders();
