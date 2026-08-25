"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Box } from "@mui/material";
import { AuthGuard } from "@/src/components/AuthGuard";
import { AppLayout } from "@/src/components/AppLayout/AppLayout";
import { CustomerLists } from "@/src/components/CustomerLists/CustomerLists";
import { ChatPanel } from "@/src/components/ChatPanel/ChatPanel";
import { NotificationPermissionModal } from "@/src/components/ReusableComponent/NotificationPermissionModal";
import UpdateNotification from "@/src/components/UpdateNotification/UpdateNotification";
import MaintenancePage from "@/src/components/MaintenancePage/MaintenancePage";
import { useVersionCheck } from "@/src/hooks/useVersionCheck";
import { useServiceRetry } from "@/src/hooks/useServiceRetry";
import { useIsMobile } from "@/src/hooks/useIsMobile";
import { IconButton } from "@mui/material";
import { Menu } from "lucide-react";
import type { ConversationListEntry } from "@/src/types/conversation";

function HomeContent() {
  const [selectedCustomer, setSelectedCustomer] = useState<ConversationListEntry | null>(null);
  const [detailsPanelOpen, setDetailsPanelOpen] = useState(false);
  const [serviceMessage, setServiceMessage] = useState("");
  const [isConversationRead, setIsConversationRead] = useState(false);
  const selectedCustomerRef = useRef<ConversationListEntry | null>(null);
  const isMobile = useIsMobile();

  // ── Service down retry (phased: silent → auto-1 → auto-5 → stopped) ────────
  const {
    showMaintenancePage: serviceDown,
    phase: retryPhase,
    attempt: retryAttempt,
    maxAttempts: retryMaxAttempts,
    countdown: retryCountdown,
    countdownMax: retryCountdownMax,
    checking: retryChecking,
    handleServiceDown,
    handleServiceUp,
    retryNow,
  } = useServiceRetry({
    onServiceUp: () => {
      // Only do cleanup here — do NOT dispatch SERVICE_UP event.
      // handleServiceUp is already triggered by the SERVICE_UP event listener
      // below, so dispatching it again would cause infinite recursion:
      // onServiceUp → dispatch SERVICE_UP → handleServiceUp → succeed → onServiceUp → ...
      setServiceMessage("");
    },
  });

  // ── Conversation read callback ─────────────────────────────────────────────
  // Passed to ChatPanel → useConversation → useReadReceipt.
  // When true, CustomerLists clears the unread badge for the selected conversation.
  const handleConversationRead = useCallback((read: boolean) => {
    setIsConversationRead(read);
  }, []);

  // ── Version update detection ───────────────────────────────────────────────
  const {
    updateAvailable,
    serverVersion,
    buildTime,
    dismissUpdate,
    applyUpdate,
  } = useVersionCheck();

  useEffect(() => {
    selectedCustomerRef.current = selectedCustomer;
  }, [selectedCustomer]);

  // ── Service down/up events ──────────────────────────────────────────────────
  useEffect(() => {
    const handleServiceDownEvent = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setServiceMessage(detail?.message || "Cannot connect to the server. Please check your connection.");
      handleServiceDown();
    };
    const handleServiceUpEvent = () => {
      handleServiceUp();
    };
    window.addEventListener("SERVICE_DOWN", handleServiceDownEvent);
    window.addEventListener("SERVICE_UP", handleServiceUpEvent);
    return () => {
      window.removeEventListener("SERVICE_DOWN", handleServiceDownEvent);
      window.removeEventListener("SERVICE_UP", handleServiceUpEvent);
    };
  }, [handleServiceDown, handleServiceUp]);

  // ── Real-time window events ───────────────────────────────────────────────
  useEffect(() => {
    // SELECT_CONVERSATION: select an existing conversation by ID (from
    // notifications, CommonGroupsSection, useMessageActions, etc.)
    const handleSelectConversation = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      const conversationId = detail?.conversationId ?? detail?.ConversationId;
      if (!conversationId) return;
      // The conversation list will have the full customer object; find it
      // via a temporary dispatch that CustomerLists can respond to. For now,
      // if a customer object is provided, use it directly.
      if (detail?.customer) {
        setSelectedCustomer(detail.customer as ConversationListEntry);
      }
    };

    // SELECT_NEW_CONVERSATION: select a newly created conversation (from
    // CreateGroup, useMessageActions, etc.)
    const handleSelectNewConversation = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail?.customer) {
        setSelectedCustomer(detail.customer as ConversationListEntry);
      }
    };

    // DELETE_CONVERSATION / DELETE_CONVERSATION_ITEM: clear selected customer
    // if it matches the deleted conversation
    const handleDeleteConversation = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      const deletedId = detail?.conversationId ?? detail?.ConversationId;
      if (!deletedId) {
        setSelectedCustomer(null);
        return;
      }
      setSelectedCustomer((prev) => {
        if (prev && Number(prev.ConversationId) === Number(deletedId)) return null;
        return prev;
      });
    };

    // UPDATE_CONVERSATION_ITEM: update the selected customer when its info
    // changes (group name, description, profile photo, etc.) so the chat
    // header stays in sync with the conversation list.
    const handleUpdateConversationItem = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (!detail) return;
      const conversationId = detail.ConversationId ?? detail.conversationId;
      if (conversationId == null) return;
      setSelectedCustomer((prev) => {
        if (!prev || Number(prev.ConversationId) !== Number(conversationId)) return prev;
        const updated = { ...prev } as Record<string, unknown>;
        if (detail.name !== undefined) updated.name = detail.name;
        if (detail.ConversationName !== undefined) updated.ConversationName = detail.ConversationName;
        if (detail.ProfileImageUrl !== undefined) updated.ProfileImageUrl = detail.ProfileImageUrl;
        if (detail.ProfileImage !== undefined) updated.ProfileImage = detail.ProfileImage;
        if (detail.GroupDesc !== undefined) updated.GroupDesc = detail.GroupDesc;
        if (detail.Description !== undefined) updated.GroupDesc = detail.Description;
        if (detail.RemoveInGroup !== undefined) updated.RemoveInGroup = detail.RemoveInGroup;
        if (detail.IsStar !== undefined) updated.IsStar = detail.IsStar;
        if (detail.IsPin !== undefined) updated.IsPin = detail.IsPin;
        if (detail.IsAdmin !== undefined) updated.IsAdmin = detail.IsAdmin;
        // Group permission fields (toggled from CustomerDetails)
        if (detail.EditGroup !== undefined) updated.EditGroup = detail.EditGroup;
        if (detail.SendNewMessage !== undefined) updated.SendNewMessage = detail.SendNewMessage;
        if (detail.AddOtherMember !== undefined) updated.AddOtherMember = detail.AddOtherMember;
        if (detail.InviteToGroup !== undefined) updated.InviteToGroup = detail.InviteToGroup;
        if (detail.ApproveNewMembers !== undefined) updated.ApproveNewMembers = detail.ApproveNewMembers;
        if (detail.AllowDeleteForAll !== undefined) updated.AllowDeleteForAll = detail.AllowDeleteForAll;
        return updated as ConversationListEntry;
      });
    };

    window.addEventListener("SELECT_CONVERSATION", handleSelectConversation as EventListener);
    window.addEventListener("SELECT_NEW_CONVERSATION", handleSelectNewConversation as EventListener);
    window.addEventListener("DELETE_CONVERSATION", handleDeleteConversation as EventListener);
    window.addEventListener("DELETE_CONVERSATION_ITEM", handleDeleteConversation as EventListener);
    window.addEventListener("UPDATE_CONVERSATION_ITEM", handleUpdateConversationItem as EventListener);

    return () => {
      window.removeEventListener("SELECT_CONVERSATION", handleSelectConversation as EventListener);
      window.removeEventListener("SELECT_NEW_CONVERSATION", handleSelectNewConversation as EventListener);
      window.removeEventListener("DELETE_CONVERSATION", handleDeleteConversation as EventListener);
      window.removeEventListener("DELETE_CONVERSATION_ITEM", handleDeleteConversation as EventListener);
      window.removeEventListener("UPDATE_CONVERSATION_ITEM", handleUpdateConversationItem as EventListener);
    };
  }, []);

  // ── Prevent browser from opening files dropped outside a conversation ───────
  useEffect(() => {
    const preventDefaultDrop = (e: DragEvent) => {
      e.preventDefault();
    };
    window.addEventListener("dragover", preventDefaultDrop);
    window.addEventListener("drop", preventDefaultDrop);
    return () => {
      window.removeEventListener("dragover", preventDefaultDrop);
      window.removeEventListener("drop", preventDefaultDrop);
    };
  }, []);

  return (
    <AppLayout
      detailsPanelOpen={detailsPanelOpen}
      mobileMenuTrigger={(open) => (
        <IconButton
          onClick={open}
          className="tap-target"
          sx={{
            color: "var(--color-text-2nd)",
            "-webkit-tap-highlight-color": "transparent",
          }}
          aria-label="Open menu"
        >
          <Menu size={22} />
        </IconButton>
      )}
    >
      <div style={{ display: "flex", height: "100dvh", overflow: "hidden" }}>
        {/* Conversation list panel — on mobile, hidden when a conversation is selected */}
        <div
          style={{
            display: isMobile && selectedCustomer ? "none" : "flex",
            flex: isMobile ? "1 1 100%" : "0 0 auto",
            minWidth: 0,
            height: "100%",
          }}
        >
          <CustomerLists
            onCustomerSelect={setSelectedCustomer}
            selectedCustomer={selectedCustomer}
            isConversationRead={isConversationRead}
          />
        </div>

        {/* Chat conversation panel — on mobile, full-screen when a conversation is selected */}
        <div
          style={{
            display: isMobile && !selectedCustomer ? "none" : "flex",
            flex: 1,
            minWidth: 0,
            flexDirection: "column",
            height: "100%",
          }}
        >
          <ChatPanel
            selectedCustomer={selectedCustomer}
            onCustomerSelect={setSelectedCustomer}
            onConversationRead={handleConversationRead}
            onDetailsPanelOpenChange={setDetailsPanelOpen}
            onBack={isMobile ? () => setSelectedCustomer(null) : undefined}
          />
        </div>
      </div>

      {/* Notification permission guide modal */}
      <NotificationPermissionModal />

      {/* Maintenance / service-down overlay */}
      {serviceDown && (
        <Box
          sx={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "var(--color-surface)",
            zIndex: 100000,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <MaintenancePage
            message={serviceMessage}
            onRetry={retryNow}
            phase={retryPhase}
            attempt={retryAttempt}
            maxAttempts={retryMaxAttempts}
            countdown={retryCountdown}
            countdownMax={retryCountdownMax}
            checking={retryChecking}
          />
        </Box>
      )}

      {/* Update notification banner */}
      <UpdateNotification
        updateAvailable={updateAvailable}
        serverVersion={serverVersion}
        buildTime={buildTime}
        onRefresh={applyUpdate}
        onDismiss={dismissUpdate}
      />
    </AppLayout>
  );
}

export default function Home() {
  return (
    <AuthGuard>
      <HomeContent />
    </AuthGuard>
  );
}
