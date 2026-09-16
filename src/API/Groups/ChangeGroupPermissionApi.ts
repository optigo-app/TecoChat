import { CommonAPI, buildCommonBody } from "../InitialApi/CommonApi";
import { emitPermissionChanged } from "../../socket";
import { getGroupMemberIds } from "../../utils/groupSocketHelpers";
import type { AuthData } from "../../contexts/LoginData";

export interface ChangeGroupPermissionParams {
  conversationId: number | string;
  permissionName: string;
  permissionValue: boolean;
  allPermissions?: Record<string, number> | null;
}

export const changeGroupPermissionApi = async (
  auth: AuthData,
  {
    conversationId,
    permissionName,
    permissionValue,
    allPermissions = null,
  }: ChangeGroupPermissionParams
): Promise<any> => {
  try {
    const payload = {
      UserId: Number(auth?.id ?? auth?.userId),
      ConversationId: Number(conversationId),
      PermissionName: permissionName,
      PermissionValue: permissionValue ? 1 : 0,
    };

    const body = buildCommonBody(
      "ChangeGroupPermission",
      auth,
      payload,
      "Group ( ChangeGroupPermission )"
    );
    const response = await CommonAPI(body);

    if (response?.Status === "200") {
      const rd =
        response?.Data?.rd?.[0] ||
        (Array.isArray(response?.rd) ? response.rd[0] : response?.Data?.rd || response?.rd);

      if (rd?.stat === 0) {
        return response;
      }

      const allMemberIds = await getGroupMemberIds(conversationId, auth);

      emitPermissionChanged({
        ufcc: auth?.ufcc,
        eventType: "permission_changed",
        conversationId: Number(conversationId),
        ReceiverId: allMemberIds,
        changedBy: {
          userId: auth?.id || auth?.userId,
          name: auth?.username || (auth as { name?: string }).name,
          email: (auth as { email?: string }).email,
        },
        permissions: allPermissions || {
          [permissionName]: permissionValue ? 1 : 0,
        },
        changedPermission: {
          name: permissionName,
          value: permissionValue ? 1 : 0,
        },
        timestamp: new Date().toISOString(),
      });
    }

    return response;
  } catch (error) {
    console.error("Error changing group permission:", error);
    return null;
  }
};
