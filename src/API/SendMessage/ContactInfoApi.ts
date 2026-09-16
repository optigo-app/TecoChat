import { CommonAPI, buildCommonBody } from "../InitialApi/CommonApi";
import type { AuthData } from "../../contexts/LoginData";

interface AuthLike {
  id?: string;
  userId?: string;
}

/**
 * Fetch contact info for a user.
 * Mirrors the old React app's ContactInfoApi.js.
 *
 * Endpoint: ContactInfo
 */
export const contactInfoApi = async (
  auth: AuthLike | AuthData | null,
  { contactUserId }: { contactUserId?: string | number } = {}
) => {
  try {
    if (!auth) {
      throw new Error("auth is required for contactInfoApi");
    }

    const payload = {
      UserId: contactUserId ?? 0,
    };

    const body = buildCommonBody("ContactInfo", auth, payload, "contactInfoApi");
    const response = await CommonAPI(body);
    return response;
  } catch (error) {
    console.error("contactInfoApi Error:", error);
    return null;
  }
};
