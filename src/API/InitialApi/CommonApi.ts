import axios from "axios";
import { APIURL, getApiHeaders } from "./Config";
import { getClientIpAddress } from "../../utils/globalFunc";

interface AuthLike {
  userId?: string;
}

interface CommonBody {
  con: string;
  p: string;
  f: string;
}

// Helper to build standard body with con/p/f fields
export const buildCommonBody = (
  mode: string,
  auth: AuthLike | string,
  payloadObject: unknown,
  fLabel?: string
): CommonBody => {
  const appUserId = typeof auth === "string" ? auth : (auth?.userId ?? "");
  return {
    con: `{"id":"","mode":"${mode}","appuserid":"${appUserId}"}`,
    p: JSON.stringify(payloadObject ?? {}),
    f: fLabel ?? "",
  };
};

export const buildLoginBody = (
  mode: string,
  appUserId: string,
  payloadObject: unknown,
  fLabel?: string
): CommonBody => {
  return buildCommonBody(mode, appUserId ?? "", payloadObject, fLabel);
};

interface CommonApiOptions {
  authType?: string;
  pageName?: string;
  signal?: AbortSignal;
  headers?: Record<string, string>;
  url?: string;
  apiVersion?: string;
}

export const CommonAPI = async (
  body: CommonBody,
  version?: string | CommonApiOptions,
  pageName?: string,
  signal?: AbortSignal
): Promise<any> => {
  try {
    let options: CommonApiOptions = {};

    if (version && typeof version === "object") {
      options = version as CommonApiOptions;
    } else {
      const looksLikeSignal = (value: unknown): value is AbortSignal =>
        !!value &&
        typeof value === "object" &&
        ("aborted" in (value as any) ||
          typeof (value as any).addEventListener === "function");

      if (version === "login") {
        options = { authType: "login", pageName, signal };
      } else if (looksLikeSignal(pageName) && typeof version === "string") {
        options = { authType: "default", pageName: version, signal: pageName };
      } else {
        options = { authType: "default", pageName, signal };
      }
    }

    // Inject client IP address into the con field
    if (body && typeof body === "object" && typeof body.con === "string") {
      try {
        const ipAddress = await getClientIpAddress();
        const conObj = JSON.parse(body.con);

        if (
          conObj &&
          typeof conObj === "object" &&
          !Array.isArray(conObj) &&
          !("IPAddress" in conObj)
        ) {
          body.con = JSON.stringify({ ...conObj, IPAddress: ipAddress ?? "" });
        }
      } catch {
        // Ignore IP injection failures
      }
    }

    const headers: Record<string, string> = {
      ...getApiHeaders(),
      ...(options?.headers ?? {}),
    };

    const url = options?.url ?? APIURL();

    const { data } = await axios.post(url, body, {
      headers,
      ...(options?.signal && { signal: options.signal }),
    });
    return data;
  } catch (error: any) {
    if (axios.isCancel(error) || error?.code === "ERR_CANCELED") {
      console.log("Request canceled:", error.message);
      throw new Error("AbortError");
    }
    console.error("API Error:", error);
    return null;
  }
};
