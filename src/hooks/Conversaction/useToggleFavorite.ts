"use client";

import { useCallback } from "react";
import { updateConversationApi } from "../../API/SendMessage/updateConversationApi";
import { showToast } from "../../utils/toastHelper";
import type { AuthData } from "../../contexts/LoginData";
import type { ConversationListEntry } from "../../types/conversation";

interface UseToggleFavoriteParams {
  selectedCustomer: ConversationListEntry | null;
  auth: AuthData | null;
  isFavorite: boolean;
  updateFavoriteStatus: (convId: string | number, isStar: number) => void;
  refresh?: () => void;
}

export function useToggleFavorite({
  selectedCustomer,
  auth,
  isFavorite,
  updateFavoriteStatus,
  refresh,
}: UseToggleFavoriteParams) {
  return useCallback(async () => {
    if (!selectedCustomer?.ConversationId) return;
    const newIsStar = isFavorite ? 0 : 1;
    updateFavoriteStatus(selectedCustomer.ConversationId, newIsStar);

    try {
      const response = await updateConversationApi(auth, {
        conversationId: selectedCustomer.ConversationId,
        isPin: (selectedCustomer as any).IsPin || 0,
        isStar: newIsStar,
        isArchived: (selectedCustomer as any).IsArchived || 0,
      });

      const rd = response?.Data?.rd?.[0] ?? response?.rd?.[0];
      const stat = rd?.stat;
      if (stat === 1 || response?.Status === "200" || response?.success === true) {
        showToast(newIsStar ? "Added to favorites" : "Removed from favorites", "success");
        if (refresh) refresh();

        // Real-time sync: notify the conversation list so its star icon
        // updates immediately. CustomerLists/useConversationList listens for
        // UPDATE_CONVERSATION_ITEM and merges IsStar into its local state.
        // Without this, the list only updates on next full reload.
        window.dispatchEvent(
          new CustomEvent("UPDATE_CONVERSATION_ITEM", {
            detail: {
              ConversationId: selectedCustomer.ConversationId,
              IsStar: newIsStar,
              isStatusChange: true,
            },
          })
        );
      } else {
        updateFavoriteStatus(selectedCustomer.ConversationId, isFavorite ? 1 : 0);
        showToast("Failed to update favorite status", "error");
      }
    } catch {
      updateFavoriteStatus(selectedCustomer.ConversationId, isFavorite ? 1 : 0);
      showToast("Error updating favorite status", "error");
    }
  }, [selectedCustomer, auth, isFavorite, updateFavoriteStatus, refresh]);
}
