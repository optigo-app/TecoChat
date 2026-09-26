// Group socket helpers — ported from OldChatReactCode/src/utils/groupSocketHelpers.js
// Provides utilities for group member resolution, read-receipt formatting,
// permission checks, notification formatting, and socket payload building.

import { fetchGroupDetails } from "../API/Groups/FetchGroupDetails";
import type { AuthData } from "../contexts/LoginData";

/**
 * Get all member IDs for a group.
 */
export const getGroupMemberIds = async (
  conversationId: number | string,
  auth: AuthData
): Promise<number[]> => {
  try {
    const groupData = await fetchGroupDetails(conversationId, auth);
    if (groupData && groupData.members) {
      return groupData.members.map((m: { UserId: number }) => m.UserId);
    }
    return [];
  } catch (error) {
    console.error("Error fetching group members:", error);
    return [];
  }
};
