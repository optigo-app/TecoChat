import { CommonAPI, buildCommonBody } from "../InitialApi/CommonApi";
import type { AuthData } from "../../contexts/LoginData";

interface AuthLike {
  id?: string;
  userId?: string;
}

/**
 * Fetch the forward list (conversations available for forwarding).
 * Mirrors the old React app's forwardlistApi.js.
 *
 * Endpoint: GetForwardList
 */
export const getForwardListApi = async (
  auth: AuthLike | AuthData | null,
  { fLabel = "forward list ( forward list )" }: { fLabel?: string } = {}
) => {
  try {
    if (!auth) {
      throw new Error("auth is required for GetForwardList");
    }

    const payload = {
      UserId: (auth as AuthLike).id ?? 0,
    };

    const body = buildCommonBody("GetForwardList", auth, payload, fLabel);
    const response = await CommonAPI(body);
    return response;
  } catch (error) {
    console.error("GetForwardList Error:", error);
    return null;
  }
};
