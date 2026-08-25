// Ported from OldChatReactCode/src/API/Groups/FetchGroupDetails.js

import { CommonAPI, buildCommonBody } from "../InitialApi/CommonApi";
import type { AuthData } from "../../context/LoginData";

export interface GroupMember {
  UserId: number;
  IsGroupAdmin?: number;
  [key: string]: unknown;
}

export interface GroupDetailsResponse {
  status: string;
  message?: string;
  groupDetails: Record<string, unknown> | null;
  members: GroupMember[];
}

export const fetchGroupDetails = async (
  conversationId: number | string,
  auth: AuthData,
  fLabel = "Group ( GroupDetails )"
): Promise<GroupDetailsResponse | null> => {
  try {
    const payload = {
      UserId: Number(auth?.id ?? auth?.userId),
      ConversationId: Number(conversationId),
    };

    const body = buildCommonBody("GroupDetails", auth, payload, fLabel);
    const response = await CommonAPI(body);

    if (response?.Data) {
      return {
        status: response.Status,
        message: response.Message,
        groupDetails: response.Data.rd?.[0] || null,
        members: response.Data.rd1 || [],
      };
    }
    return null;
  } catch (error) {
    console.error("Error fetching group details:", error);
    return null;
  }
};
