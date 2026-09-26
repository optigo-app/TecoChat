const LOCAL_HOSTS = (process.env.NEXT_PUBLIC_LOCAL_HOSTS || "localhost,nzen,tecochat.web,web")
  .split(",")
  .map((h) => h.trim())
  .filter(Boolean);

export const getEnvFlags = () => {
  if (typeof window === "undefined")
    return { isLocal: false, isNxt: false };
  const hostname = window.location.hostname;
  return {
    isLocal: LOCAL_HOSTS.includes(hostname),
    isNxt: hostname.startsWith("nxt") && hostname.endsWith(".optigoapps.com"),
  };
};

const getIsLocal = (): boolean => getEnvFlags().isLocal;  

export const getApiBaseUrl = (): string => {
  const { isLocal, isNxt } = getEnvFlags();

  return isLocal
    ? process.env.NEXT_PUBLIC_API_DEVELOPMENT_URL || "http://newnextjs.web/api"
    : isNxt
      ? process.env.NEXT_PUBLIC_API_NXT_PRODUCTION_URL || "https://nxt22.optigoapps.com/apilx"
      : process.env.NEXT_PUBLIC_API_PRODUCTION_URL || "https://apilx.optigoapps.com/api";
};

export const getSocketURL = (): string => {
  const { isLocal, isNxt } = getEnvFlags();

  return isLocal
    ? process.env.NEXT_PUBLIC_SOCKET_DEVELOPMENT_URL || "http://newnextjs.web"
    : isNxt
      ? process.env.NEXT_PUBLIC_SOCKET_NXT_PRODUCTION_URL || "https://nxt22.optigoapps.com"
      : process.env.NEXT_PUBLIC_SOCKET_PRODUCTION_URL || "https://apilx.optigoapps.com";
};

// Media
export const UPLOAD_URL = () => `${getApiBaseUrl()}/upload`;
export const REMOVE_FILE_URL = () => `${getApiBaseUrl()}/removefile`;

// Report / Common APIs
export const APIURL = () => `${getApiBaseUrl()}/report`;

// file Download APIs
export const DOWNLOAD_FILE_URL = () => `${getApiBaseUrl()}/downloadfile`;

interface ApiCredentials {
  yc?: string;
  sv?: string;
}

export const getApiHeaders = (): Record<string, string> => {
  let credentials: ApiCredentials | null = null;
  let userVersion: string | null = null;

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

      const v = parsedUser?.cuver;
      if (typeof v === "string" && v.trim()) {
        userVersion = v.trim();
      }
    } catch {
      // ignore parse errors
    }
  }

  const headers: Record<string, string> = {
    Version:
      userVersion ??
      (getIsLocal()
        ? process.env.NEXT_PUBLIC_VERSION_LOCAL || "R50B3"
        : process.env.NEXT_PUBLIC_VERSION_PROD || "R75PRO"),
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
