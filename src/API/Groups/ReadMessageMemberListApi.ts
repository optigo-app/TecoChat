import { CommonAPI, buildCommonBody } from "../InitialApi/CommonApi";
import type { AuthData } from "../../context/LoginData";

export interface ReadMessageMemberListResponse {
  status?: string;
  message?: string;
  readBy: unknown[];
  deliveredTo: unknown[];
}

export const readMessageMemberList = async (
  messageId: number | string,
  auth: AuthData,
  fLabel = "Group (ReadMessageMemberList)"
): Promise<ReadMessageMemberListResponse> => {
  try {
    const payload = {
      MessageId: Number(messageId),
    };

    const body = buildCommonBody("ReadMessageMemberList", auth, payload, fLabel);
    const response = await CommonAPI(body);

    if (response?.Data) {
      return {
        status: response.Status,
        message: response.Message,
        readBy: response.Data.rd || [],
        deliveredTo: response.Data.rd1 || [],
      };
    }
    return { readBy: [], deliveredTo: [] };
  } catch (error) {
    console.error("Error fetching message member list:", error);
    return { readBy: [], deliveredTo: [] };
  }
};
