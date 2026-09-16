// Ported from OldChatReactCode/src/hooks/Conversaction/useGroupSocketListeners.js

"use client";

import { useEffect } from "react";
import toast from "react-hot-toast";
import { notify } from "../../utils/notificationTemplates";
import type { AuthData } from "../../contexts/LoginData";

interface UseGroupSocketListenersParams {
  selectedCustomer: any;
  auth: AuthData;
  refresh?: () => void;
  updateRemoveInGroupStatus: (
    conversationId: string | number,
    isRemoved: boolean | number
  ) => void;
  updateGroupAdminMode: (
    conversationId: string | number,
    isOnlyAdminSend: boolean
  ) => void;
  setIsCurrentUserAdmin: (isAdmin: boolean) => void;
  registerListener: (
    conversationId: string | number,
    callbacks: {
      onGroupEvent?: (data: any) => void;
      onMemberEvent?: (data: any) => void;
      onPermissionEvent?: (data: any) => void;
    }
  ) => void;
  unregisterListener: (conversationId: string | number) => void;
  addUniqueMessage?: (message: any) => void;
  onCustomerSelect?: (customer: any) => void;
}

export const useGroupSocketListeners = ({
  selectedCustomer,
  auth,
  refresh,
  updateRemoveInGroupStatus,
  updateGroupAdminMode,
  setIsCurrentUserAdmin,
  registerListener,
  unregisterListener,
  addUniqueMessage,
  onCustomerSelect,
}: UseGroupSocketListenersParams) => {
  useEffect(() => {
    if (!selectedCustomer?.IsGroup || !selectedCustomer?.ConversationId) return;

    const conversationId = selectedCustomer.ConversationId;
    const currentUserId = auth?.id || auth?.userId;

    const callbacks = {
      onGroupEvent: (data: any) => {
        if (data.conversationId !== conversationId) return;

        if (data.conversationData && addUniqueMessage) {
          addUniqueMessage(data.conversationData);
        }

        const eventNotificationMap: Record<string, string> = {
          group_created: "GROUP_CREATED",
          group_updated: "GROUP_UPDATED",
        };

        const notificationTemplate = eventNotificationMap[data.eventType];
        if (notificationTemplate) {
          notify(data, notificationTemplate, auth);
        }

        if (data.eventType === "group_deleted") {
          toast.error("This group has been deleted");
          if (onCustomerSelect) onCustomerSelect(null);
          return;
        }

        const shouldSkipRefresh = ["group_updated", "group_created"].includes(
          data.eventType
        );
        if (refresh && !shouldSkipRefresh) {
          setTimeout(() => refresh(), 500);
        }
      },

      onMemberEvent: (data: any) => {
        if (data.conversationId !== conversationId) return;

        if (data.conversationData && addUniqueMessage) {
          addUniqueMessage(data.conversationData);
        }

        const isCurrentUserRemoved =
          data.eventType === "member_removed" &&
          Number(data.removedMemberId) === Number(currentUserId);

        const eventNotificationMap: Record<string, string> = {
          member_added: "MEMBER_ADDED",
          member_removed: isCurrentUserRemoved
            ? "YOU_WERE_REMOVED"
            : "MEMBER_REMOVED",
          member_promoted: "MEMBER_PROMOTED",
          member_demoted: "MEMBER_DEMOTED",
        };

        const notificationTemplate = eventNotificationMap[data.eventType];
        if (notificationTemplate) {
          notify(data, notificationTemplate, auth);
        }

        const eventMessages: Record<string, string> = {
          member_added: `${data.memberName || "Member"} added to group`,
          member_removed: `${data.memberName || "Member"} removed from group`,
          member_promoted: `${data.memberName || "Member"} promoted to admin`,
          member_demoted: `${data.memberName || "Member"} demoted from admin`,
        };

        const message = eventMessages[data.eventType] || "Member event";
        if (isCurrentUserRemoved) {
          updateRemoveInGroupStatus(conversationId, true);
          toast.error("You were removed from this group");
        } else if (data.eventType === "member_added") {
          const isCurrentUserAdded = data.newMemberIds?.some(
            (id: any) => Number(id) === Number(currentUserId)
          );
          if (isCurrentUserAdded) {
            updateRemoveInGroupStatus(conversationId, false);
            toast.success("You were added to the group");
          } else {
            toast(message);
          }
        } else if (
          data.eventType === "member_promoted" ||
          data.eventType === "member_demoted"
        ) {
          const isAffectedMember =
            Number(data.memberId) === Number(currentUserId);
          if (isAffectedMember) {
            setIsCurrentUserAdmin(data.eventType === "member_promoted");
          }
          toast(message);
        } else {
          toast(message);
        }

        const shouldSkipRefresh = [
          "member_added",
          "member_removed",
          "member_promoted",
          "member_demoted",
        ].includes(data.eventType);
        if (refresh && !shouldSkipRefresh) {
          setTimeout(() => refresh(), 500);
        }
      },

      onPermissionEvent: (data: any) => {
        if (Number(data.conversationId) !== Number(conversationId)) return;

        notify(data, "PERMISSION_CHANGED", auth);

        if (
          data.changedPermission &&
          data.changedPermission.name === "SendNewMessage"
        ) {
          updateGroupAdminMode(conversationId, data.changedPermission.value === 0);
        } else if (
          data.permissions &&
          data.permissions.SendNewMessage !== undefined
        ) {
          updateGroupAdminMode(conversationId, data.permissions.SendNewMessage === 0);
        }

        // Add client-side system message for permission change
        if (addUniqueMessage && data.changedPermission) {
          const permissionFriendlyNames: Record<string, string> = {
            SendNewMessage: "sending messages",
            EditGroup: "editing group settings",
            AddOtherMember: "adding members",
            inviteToGroup: "inviting via link",
            ApproveNewMembers: "approving new members",
            AllowDeleteForAll: "deleting messages",
          };
          const friendlyName =
            permissionFriendlyNames[data.changedPermission.name] ||
            data.changedPermission.name;
          const permissionMsg = {
            Id: `temp_permission_${Date.now()}`,
            ConversationId: data.conversationId,
            Message: `${data.changedBy?.name || "Someone"} ${
              data.changedPermission.value ? "enabled" : "disabled"
            } ${friendlyName}`,
            SystemMsg: 1,
            DateTime: new Date().toISOString(),
          };
          addUniqueMessage(permissionMsg);
        }
      },
    };

    registerListener(conversationId, callbacks);
    return () => {
      unregisterListener(conversationId);
    };
  }, [
    selectedCustomer?.ConversationId,
    selectedCustomer?.IsGroup,
    auth?.id,
    auth?.userId,
    auth,
    refresh,
    updateRemoveInGroupStatus,
    updateGroupAdminMode,
    setIsCurrentUserAdmin,
    registerListener,
    unregisterListener,
    addUniqueMessage,
    onCustomerSelect,
  ]);
};
