"use client";

import { useState, useCallback } from "react";
import {
  muteConversationApi,
  computeMuteExpiry,
  type MuteDuration,
} from "../../API/ConversationMute/MuteConversationApi";
import { showToast } from "../../utils/toastHelper";
import type { AuthData } from "../../contexts/LoginData";
import type { ConversationListEntry } from "../../types/conversation";

interface UseMuteConversationParams {
  selectedCustomer: ConversationListEntry | null;
  auth: AuthData | null;
  onCustomerSelect?: ((customer: ConversationListEntry | null) => void) | null;
}

export function useMuteConversation({
  selectedCustomer,
  auth,
  onCustomerSelect,
}: UseMuteConversationParams) {
  const [muteDialogOpen, setMuteDialogOpen] = useState(false);
  const [muteLoading, setMuteLoading] = useState(false);

  const handleMuteConversation = useCallback(
    async (duration: MuteDuration) => {
      if (!selectedCustomer?.ConversationId || !auth) return;
      setMuteLoading(true);
      try {
        const expiresAt = computeMuteExpiry(duration);
        const result = await muteConversationApi(auth, {
          conversationId: selectedCustomer.ConversationId,
          isMuted: 1,
          muteExpiresAt: expiresAt,
        });
        if (result?.stat == 1) {
          // Update local conversation state so UI reflects mute immediately
          window.dispatchEvent(
            new CustomEvent("UPDATE_CONVERSATION_MUTE", {
              detail: {
                conversationId: selectedCustomer.ConversationId,
                isMuted: 1,
                muteExpiresAt: result.MuteExpiresAt ?? expiresAt,
              },
            })
          );
          // Also update selectedCustomer via onCustomerSelect so header updates
          if (onCustomerSelect) {
            onCustomerSelect({
              ...selectedCustomer,
              IsMuted: 1,
              MuteExpiresAt: result.MuteExpiresAt ?? expiresAt,
            } as any);
          }
          showToast("Notifications muted", "success");
        } else {
          showToast(result?.stat_msg || "Failed to mute notifications", "error");
        }
      } catch (err) {
        console.error("handleMuteConversation error:", err);
        showToast("Error muting notifications", "error");
      } finally {
        setMuteLoading(false);
        setMuteDialogOpen(false);
      }
    },
    [selectedCustomer, auth, onCustomerSelect]
  );

  const handleUnmuteConversation = useCallback(async () => {
    if (!selectedCustomer?.ConversationId || !auth) return;
    setMuteLoading(true);
    try {
      const result = await muteConversationApi(auth, {
        conversationId: selectedCustomer.ConversationId,
        isMuted: 0,
        muteExpiresAt: null,
      });
      if (result?.stat == 1) {
        window.dispatchEvent(
          new CustomEvent("UPDATE_CONVERSATION_MUTE", {
            detail: {
              conversationId: selectedCustomer.ConversationId,
              isMuted: 0,
              muteExpiresAt: null,
            },
          })
        );
        if (onCustomerSelect) {
          onCustomerSelect({
            ...selectedCustomer,
            IsMuted: 0,
            MuteExpiresAt: null,
          } as any);
        }
        showToast("Notifications unmuted", "success");
      } else {
        showToast(result?.stat_msg || "Failed to unmute notifications", "error");
      }
    } catch (err) {
      console.error("handleUnmuteConversation error:", err);
      showToast("Error unmuting notifications", "error");
    } finally {
      setMuteLoading(false);
    }
  }, [selectedCustomer, auth, onCustomerSelect]);

  return {
    muteDialogOpen,
    setMuteDialogOpen,
    muteLoading,
    handleMuteConversation,
    handleUnmuteConversation,
  };
}
