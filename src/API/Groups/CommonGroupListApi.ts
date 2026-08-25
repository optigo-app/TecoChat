import { CommonAPI, buildCommonBody } from "../InitialApi/CommonApi";
import type { AuthData } from "../../context/LoginData";

export interface CommonGroupListParams {
  userId: number | string;
  conversationId: number | string;
}

export const CommonGroupListApi = async (
  auth: AuthData,
  { userId, conversationId }: CommonGroupListParams
): Promise<any> => {
  try {
    const payload = {
      UserId: Number(userId) || 0,
      ConversationId: Number(conversationId) || 0,
    };

    const body = buildCommonBody(
      "CommonGroupList",
      auth,
      payload,
      "List ( Common Group List )"
    );
    const response = await CommonAPI(body);

    return response;
  } catch (error) {
    console.error("Error in CommonGroupListApi:", error);
    return null;
  }
};
