import { CommonAPI, buildCommonBody } from "../InitialApi/CommonApi";
import type { AuthData } from "../../contexts/LoginData";

export interface PastParticipantListParams {
  conversationId: number | string;
}

export const PastParticipantListApi = async (
  auth: AuthData,
  { conversationId }: PastParticipantListParams
): Promise<any> => {
  try {
    const payload = {
      UserId: Number(auth?.id ?? auth?.userId),
      ConversationId: Number(conversationId),
    };

    const body = buildCommonBody(
      "PastParticipantList",
      auth,
      payload,
      "List ( Past Participant List )"
    );
    const response = await CommonAPI(body);

    return response;
  } catch (error) {
    console.error("Error in PastParticipantListApi:", error);
    return null;
  }
};
