// Ported from OldChatReactCode/src/hooks/useConfirmModal.js

"use client";

import { useState, useCallback } from "react";
import toast from "react-hot-toast";
import { removeMemberApi } from "../API/Groups/RemoveMemberApi";
import { clearChatApi } from "../API/ClearChat/ClearChatApi";
import { deleteConversationApi } from "../API/ConversationView/DeleteConversationApi";
import { isMessageEditable } from "../utils/globalFunc";
import type { AuthData } from "../contexts/LoginData";
import { clearConversation } from "../db/messageCache";
import { deleteConversation as deleteCachedConversation } from "../db/conversationCache";
import { clearMembers } from "../db/groupMembersCache";
import { deleteDraft } from "../db/draftCache";

const INITIAL_STATE = { isOpen: false, actionType: "" as string };

export interface DeleteMessageAction {
  label: string;
  onClick: () => void;
  danger?: boolean;
  variant: string;
}

interface UseConfirmModalParams {
  selectedCustomer: any;
  auth: AuthData;
  onCustomerSelect: (customer: any) => void;
  refresh?: () => void;
  handleDeleteMessage: (messageId: string | number, deleteType: number) => void;
  fetchAndCacheGroupMembers: (conversationId: string | number) => Promise<any>;
  isCurrentUserAdmin: boolean;
  getGroupPermission: (
    conversationId: string | number,
    permissionName: string
  ) => unknown;
}

export function useConfirmModal({
  selectedCustomer,
  auth,
  onCustomerSelect,
  refresh,
  handleDeleteMessage,
  fetchAndCacheGroupMembers,
  isCurrentUserAdmin,
  getGroupPermission,
}: UseConfirmModalParams) {
  const [confirmationModal, setConfirmationModal] = useState<{
    isOpen: boolean;
    actionType: string;
  }>(INITIAL_STATE);
  const [selectedMessageForDelete, setSelectedMessageForDelete] =
    useState<any>(null);

  const open = useCallback(
    (actionType: string) =>
      setConfirmationModal({ isOpen: true, actionType }),
    []
  );
  const close = useCallback(() => setConfirmationModal(INITIAL_STATE), []);

  const openDeleteMessage = useCallback(
    (message: any) => {
      setSelectedMessageForDelete(message);
      open("deleteMessage");
    },
    [open]
  );

  const checkAdminStatusAndShowConfirmation = useCallback(async () => {
    try {
      const groupData = await fetchAndCacheGroupMembers(
        selectedCustomer.ConversationId
      );
      if (groupData?.members) {
        const currentUserId = auth?.id || auth?.userId;
        const currentUser = groupData.members.find(
          (m: any) => Number(m.UserId) === Number(currentUserId)
        );
        const adminCount = groupData.members.filter(
          (m: any) => m.IsGroupAdmin === 1
        ).length;
        if (currentUser?.IsGroupAdmin === 1 && adminCount === 1) {
          open("adminCannotLeave");
        } else {
          open("exitGroup");
        }
      } else {
        open("exitGroup");
      }
    } catch {
      open("exitGroup");
    }
  }, [selectedCustomer, auth, open, fetchAndCacheGroupMembers]);

  const handleConfirmExitGroup = useCallback(async () => {
    try {
      if (!selectedCustomer?.ConversationId) {
        close();
        toast.error("No conversation selected");
        return;
      }
      const currentUserId = auth?.id || auth?.userId;
      const response = await removeMemberApi(auth, {
        conversationId: selectedCustomer.ConversationId,
        memberId: currentUserId,
      });
      const rd = response?.Data?.rd?.[0] ?? response?.rd?.[0];
      const stat = rd?.stat;
      const statMsg = rd?.stat_msg;
      if (stat === 1 || stat === "1" || response?.Status === "200") {
        toast.success("You have left the group");
        const convId = selectedCustomer.ConversationId;
        // Clear all cached data for this conversation from IndexedDB.
        clearConversation(auth, convId).catch(() => {});
        clearMembers(auth, convId).catch(() => {});
        deleteDraft(auth, convId).catch(() => {});
        deleteCachedConversation(auth, convId).catch(() => {});
        close();
        onCustomerSelect?.(null as any);
        window.dispatchEvent(
          new CustomEvent("DELETE_CONVERSATION", {
            detail: { conversationId: convId },
          })
        );
        refresh?.();
      } else {
        close();
        toast.error(statMsg || response?.Message || "Failed to exit group");
      }
    } catch (error) {
      console.error("handleConfirmExitGroup error:", error);
      close();
      toast.error("Error exiting group");
    }
  }, [selectedCustomer, auth, onCustomerSelect, refresh, close]);

  const handleConfirmDeleteChat = useCallback(async () => {
    try {
      if (!selectedCustomer?.ConversationId) {
        close();
        toast.error("No conversation selected");
        return;
      }
      const response = await deleteConversationApi(auth, {
        conversationId: selectedCustomer.ConversationId,
      });
      // Response can be { Data: { rd: [{ stat: 1, ... }] } } or { rd: [{ stat: 1, ... }] }
      const rd = response?.Data?.rd?.[0] ?? response?.rd?.[0];
      const stat = rd?.stat;
      const statMsg = rd?.stat_msg;
      if (stat === 1 || stat === "1" || response?.Status === "200" || response?.success === true) {
        toast.success(statMsg || "Conversation deleted");
        const convId = selectedCustomer.ConversationId;
        // Clear all cached data for this conversation from IndexedDB.
        clearConversation(auth, convId).catch(() => {});
        clearMembers(auth, convId).catch(() => {});
        deleteDraft(auth, convId).catch(() => {});
        deleteCachedConversation(auth, convId).catch(() => {});
        close();
        onCustomerSelect?.(null as any);
        window.dispatchEvent(
          new CustomEvent("DELETE_CONVERSATION", {
            detail: { conversationId: convId },
          })
        );
      } else {
        toast.error(statMsg || response?.Message || "Failed to delete conversation");
        close();
      }
    } catch (error) {
      console.error("handleConfirmDeleteChat error:", error);
      close();
      toast.error("Error deleting conversation");
    }
  }, [selectedCustomer, auth, onCustomerSelect, close]);

  const handleConfirmClearChat = useCallback(async () => {
    try {
      if (!selectedCustomer?.ConversationId) {
        close();
        toast.error("No conversation selected");
        return;
      }
      const response = await clearChatApi(auth, {
        conversationId: selectedCustomer.ConversationId,
        userId: auth?.id || auth?.userId,
      });
      const rd = response?.Data?.rd?.[0] ?? response?.rd?.[0];
      const stat = rd?.stat;
      const statMsg = rd?.stat_msg;
      if (stat === 1 || stat === "1" || response?.Status === "200" || response?.success === true) {
        toast.success(statMsg || "Chat cleared successfully");
        const convId = selectedCustomer.ConversationId;
        // Clear cached messages for this conversation from IndexedDB.
        clearConversation(auth, convId).catch(() => {});
        deleteDraft(auth, convId).catch(() => {});
        window.dispatchEvent(
          new CustomEvent("CLEAR_CONVERSATION_MESSAGES", {
            detail: { conversationId: convId },
          })
        );
        close();
        refresh?.();
      } else {
        close();
        toast.error(statMsg || response?.Message || "Failed to clear chat");
      }
    } catch (error) {
      console.error("handleConfirmClearChat error:", error);
      close();
      toast.error("Error clearing chat");
    }
  }, [selectedCustomer, auth, refresh, close]);

  const ACTION_CONFIRM_MAP: Record<string, (() => Promise<void>) | null> = {
    adminCannotLeave: close as unknown as () => Promise<void>,
    exitGroup: handleConfirmExitGroup,
    deleteGroup: handleConfirmDeleteChat,
    deleteChat: handleConfirmDeleteChat,
    clearChat: handleConfirmClearChat,
    deleteMessage: null,
    logout: null,
  };

  const getDeleteMessageActions = useCallback((): DeleteMessageAction[] => {
    const msg = selectedMessageForDelete;
    if (!msg) return [];
    const isOutgoing = msg?.Direction === 1;
    const timeLimit = parseInt(
      process.env.NEXT_PUBLIC_MESSAGE_EDIT_TIME_LIMIT || "15",
      10
    );
    const isWithinTimeLimit = isMessageEditable(msg, timeLimit);

    const canDeleteForAll = (() => {
      if (selectedCustomer?.IsGroup !== 1) return true;
      if (isCurrentUserAdmin) return true;
      const perm = getGroupPermission(selectedCustomer?.ConversationId, "AllowDeleteForAll");
      if (perm !== undefined) return perm === 1;
      return selectedCustomer?.AllowDeleteForAll === 1 || selectedCustomer?.AllowDeleteForAll === true;
    })();

    const deleteForEveryone = isWithinTimeLimit && isOutgoing && canDeleteForAll
      ? [
          {
            label: "Delete for everyone",
            onClick: () => {
              handleDeleteMessage(msg?.MessageId ?? msg?.Id, 2);
              close();
            },
            danger: true,
            variant: "btn-actions",
          },
        ]
      : [];

    const deleteForMe = {
      label: "Delete for me",
      onClick: () => {
        handleDeleteMessage(msg?.MessageId ?? msg?.Id, 1);
        close();
      },
      danger: true,
      variant: "btn-actions",
    };

    const cancel = {
      label: "Cancel",
      onClick: close,
      variant: "btn-actions",
    };

    // 3 actions → vertical: delete options first, Cancel at bottom
    // 2 actions → horizontal: Cancel left, Delete for me right
    if (deleteForEveryone.length > 0) {
      return [...deleteForEveryone, deleteForMe, cancel];
    }
    return [cancel, deleteForMe];
  }, [
    selectedMessageForDelete,
    handleDeleteMessage,
    close,
    selectedCustomer,
    isCurrentUserAdmin,
    getGroupPermission,
  ]);

  return {
    confirmationModal,
    open,
    close,
    openDeleteMessage,
    checkAdminStatusAndShowConfirmation,
    onConfirm: confirmationModal.actionType
      ? ACTION_CONFIRM_MAP[confirmationModal.actionType] ?? null
      : null,
    getDeleteMessageActions,
  };
}
