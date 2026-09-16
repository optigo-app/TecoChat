import { CommonAPI, buildCommonBody } from "../InitialApi/CommonApi";
import { getGroupMemberIds } from "../../utils/groupSocketHelpers";
import type { AuthData } from "../../contexts/LoginData";

export interface AdminChange {
  UserId: number | string;
  IsGroupAdmin: number;
  [key: string]: unknown;
}

export interface MultiAssignRoleParams {
  conversationId: number | string;
  adminChanges?: AdminChange[];
}

export const multiAssignRoleApi = async (
  auth: AuthData,
  { conversationId, adminChanges = [] }: MultiAssignRoleParams
): Promise<any> => {
  try {
    const payload = {
      UserId: Number(auth?.id ?? auth?.userId),
      ConversationId: Number(conversationId),
      CommonUseJson: JSON.stringify(adminChanges),
    };

    const body = buildCommonBody(
      "MultiAssignRole",
      auth,
      payload,
      "Group ( MultiAssignRole )"
    );
    const response = await CommonAPI(body);

    if (response?.Status === "200") {
      const rd =
        response?.Data?.rd?.[0] ||
        (Array.isArray(response?.rd) ? response.rd[0] : response?.Data?.rd || response?.rd);

      if (rd?.stat === 0) {
        return response;
      }

      // Member IDs fetched for potential socket emits (kept for parity; emits
      // are commented out in the original source).
      await getGroupMemberIds(conversationId, auth);
    }

    return response;
  } catch (error) {
    console.error("Error in multiAssignRoleApi:", error);
    return null;
  }
};
