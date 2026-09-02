"use client";

import { useCallback, useState, useRef, useEffect, memo } from "react";
import { Box, Typography, Menu, MenuItem, ListItemIcon, ListItemText, Divider, IconButton, useTheme, Popover, Avatar, alpha, Dialog, DialogTitle, DialogContent, DialogActions, Button } from "@mui/material";
import { MessageSquare, MoreVertical, BellOff, Bell, X, Info, CheckSquare, Star, CircleMinus, LogOut, Trash2 } from "lucide-react";
import MessageContextMenu from "./messages/MessageContextMenu";
import { useLoginContext, type AuthData } from "../../context/LoginData";
import { useConversation } from "../../hooks/useConversation";
import { useColorMode } from "../../theme/ThemeRegistry";
import { useFavorite } from "../../contexts/FavoriteContext";
import { MentionListContent, type MentionMember } from "./input/MentionDropdown";
import { useRemoveInGroup } from "../../contexts/RemoveInGroupContext";
import { useGroupAdminMode } from "../../contexts/GroupAdminModeContext";
import { useConfirmModal } from "../../hooks/useConfirmModal";
import { useDrawerState } from "../../hooks/Conversaction/useDrawerState";
import { useGroupSocketListeners } from "../../hooks/Conversaction/useGroupSocketListeners";
import { useGroupSocket } from "../../contexts/GroupSocketContext";
import { useBreakpointDown } from "../../hooks/useIsMobile";
import { updateConversationApi } from "../../API/SendMessage/updateConversationApi";
import { showToast } from "../../utils/toastHelper";
import { ChatHeader } from "./ChatHeader";
import MessageList, { type MessageListRef } from "./MessageList";
import { ChatInput } from "./ChatInput";
import MediaViewer from "./messages/MediaViewer";
import MediaPreview from "./messages/MediaPreview";
import EditMessageDialog from "./EditMessageDialog";
import MuteNotificationDialog from "./MuteNotificationDialog";
import { muteConversationApi, computeMuteExpiry, type MuteDuration } from "../../API/ConversationMute/MuteConversationApi";
import { isConversationMuted } from "../../utils/mentionUtils";
import ForwardMessage from "../ForwardMessage/ForwardMessage";
import ConfirmationDialog from "../ReusableComponent/ConfirmationDialog";
import CustomerDetails from "../CustomerDetails/CustomerDetails";
import { CONFIRM_CONFIG as confirmConfig } from "../../hooks/confirmConfig";
import type { ConversationListEntry } from "../../types/conversation";
import type { ChatMessage } from "../../types/message";
import "./ChatPanel.scss";

interface ChatPanelProps {
  selectedCustomer: ConversationListEntry | null;
  onConversationRead?: ((read: boolean) => void) | null;
  onCustomerSelect?: ((customer: ConversationListEntry) => void) | null;
  onDetailsPanelOpenChange?: ((open: boolean) => void) | null;
  onBack?: () => void;
}

export const ChatPanel = memo(({
  selectedCustomer,
  onConversationRead = null,
  onCustomerSelect = null,
  onDetailsPanelOpenChange = null,
  onBack,
}: ChatPanelProps) => {
  const theme = useTheme();
  const { resolvedMode } = useColorMode();
  const { auth } = useLoginContext();
  const messageListRef = useRef<MessageListRef>(null);
  const containerRef = useRef<HTMLElement | null>(null);

  // ── Details panel state (drawer/panel for contact/group info + search) ────
  const {
    drawerOpen,
    setDrawerOpen,
    drawerViewState,
    setDrawerViewState,
    selectedMessageForInfo,
    infoMember,
    openInfo,
    openSearch,
    openMessageInfo,
    closeDrawer,
  } = useDrawerState(selectedCustomer?.ConversationId ?? undefined);

  // Notify parent when drawer opens/closes (so AppLayout can auto-collapse sidebar)
  useEffect(() => {
    onDetailsPanelOpenChange?.(drawerOpen);
  }, [drawerOpen, onDetailsPanelOpenChange]);

  // Listen for MEDIA_REPLACE_OR_ADD events from processFiles
  useEffect(() => {
    const handleReplaceOrAdd = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.newFiles) {
        setReplaceAddDialog({
          open: true,
          newFiles: detail.newFiles,
          existingCount: detail.existingCount || 0,
        });
      }
    };
    window.addEventListener("MEDIA_REPLACE_OR_ADD", handleReplaceOrAdd as EventListener);
    return () => window.removeEventListener("MEDIA_REPLACE_OR_ADD", handleReplaceOrAdd as EventListener);
  }, []);

  // Responsive: narrow screen → drawer overlay; wider → docked side panel
  const isNarrowScreen = useBreakpointDown("lg"); // <= 1024px

  // The scroll-to-bottom button is position:absolute inside .messages-area,
  // which already shrinks when the detail panel docks. So the right offset
  // is just the padding from the right edge — no need to add panel width.
  const scrollToBottomRightOffset = 30;

  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedMessageForEdit, setSelectedMessageForEdit] = useState<ChatMessage | null>(null);

  // Replace/Add media dialog state
  const [replaceAddDialog, setReplaceAddDialog] = useState<{
    open: boolean;
    newFiles: any[] | null;
    existingCount: number;
  }>({ open: false, newFiles: null, existingCount: 0 });

  const handleEditAction = useCallback((msg: ChatMessage) => {
    setSelectedMessageForEdit(msg);
    setEditDialogOpen(true);
  }, []);

  const {
    inputValue,
    setInputValue,
    updateLatestInput,
    messages,
    mediaFiles,
    setMediaFiles,
    showMedia,
    loading,
    loadingOlder,
    loadingNewer,
    hasMoreBefore,
    hasMoreAfter,
    olderError,
    newerError,
    unreadAnchorMessageId,
    unreadCount,
    pendingNewMessages,
    isAtBottomRef,
    autoLoadNewerRef,
    flushNewMessages,
    loadedMedia,
    replyToMessage,
    forwardMessage,
    forwardAnchorEl,
    blinkMessageId,
    searchHighlightQuery,
    searchHighlightMessageId,
    mediaViewerOpen,
    mediaViewerItems,
    mediaViewerIndex,
    mediaViewerMessage,
    flattenedRows,
    messageById,
    typingStatus,
    // Functions
    loadOlderMessages,
    loadNewerMessages,
    retryLoadOlder,
    retryLoadNewer,
    jumpToLatest,
    handleAttachClick,
    handleFileChange,
    processFiles,
    handleMediaClick,
    handleClosePreview,
    handleSendMessage,
    handleReply,
    handleCancelReply,
    handleForward,
    handleCloseForward,
    handleSendForward,
    handleEditMessage,
    handleDeleteMessage,
    handleStarMessage,
    handleMessageEmojiClick,
    handleRemoveReaction,
    searchMessages,
    searchByDate,
    isSearching,
    searchResults,
    getMessageStatusIcon,
    getMediaSrcForMessage,
    getMediaKey,
    markLoaded,
    scrollToMessage,
    refresh,
    onTypingChange,
    fetchAndCacheGroupMembers,
    addUniqueMessage,
    starFilter,
    handleToggleStarFilter,
    starNewMessageCount,
  } = useConversation({
    selectedCustomer,
    onConversationRead,
    onCustomerSelect,
  });

  // ── Contexts for header menu actions ──────────────────────────────────────
  const { favoriteState, updateFavoriteStatus } = useFavorite();
  const { isRemovedFromGroup, updateRemoveInGroupStatus } = useRemoveInGroup();
  const { getGroupPermission, updateGroupAdminMode, isGroupOnlyAdminSend } = useGroupAdminMode();

  const isFavorite =
    favoriteState[selectedCustomer?.ConversationId ?? ""]?.isStar ??
    (selectedCustomer?.IsStar === 1);

  const contextRemovedStatus = isRemovedFromGroup(selectedCustomer?.ConversationId ?? "");
  const isRemovedFromCurrentGroup =
    contextRemovedStatus !== null && contextRemovedStatus !== undefined
      ? contextRemovedStatus
      : selectedCustomer?.RemoveInGroup === 1;

  // ── Mute notification state ──────────────────────────────────────────────
  const [muteDialogOpen, setMuteDialogOpen] = useState(false);
  const [muteLoading, setMuteLoading] = useState(false);
  const isCurrentlyMuted = isConversationMuted(
    (selectedCustomer as any)?.IsMuted,
    (selectedCustomer as any)?.MuteExpiresAt
  );

  const contextAdminMode = isGroupOnlyAdminSend(selectedCustomer?.ConversationId ?? "");
  const isOnlyAdminSend =
    contextAdminMode !== null && contextAdminMode !== undefined
      ? contextAdminMode
      : (selectedCustomer?.IsGroupAdmin === 1);

  // ── Consolidated conversation-change effect ───────────────────────────────
  // Fires once per conversation switch. Handles:
  //   1. Reset admin state from selectedCustomer (fast sync)
  //   2. Sync RemoveInGroup context
  //   3. Fetch group details for admin mode + current-user admin flag
  const isGroup = selectedCustomer?.IsGroup === 1;
  const currentUserId = auth?.id || auth?.userId;
  const [isCurrentUserAdmin, setIsCurrentUserAdmin] = useState<boolean>(
    isGroup &&
      (selectedCustomer?.IsGroupAdmin === 1 || selectedCustomer?.IsGroupAdmin === true)
  );
  const [groupMembers, setGroupMembers] = useState<Array<{ UserId?: string | number; MemberName?: string; UserName?: string; DisplayName?: string; ProfileImage?: string; IsGroupAdmin?: number; ConversationId?: string | number }>>([]);
  const [allMentionsAnchor, setAllMentionsAnchor] = useState<HTMLElement | null>(null);

  // Listen for @all mention clicks — show popover with all group members
  useEffect(() => {
    const handleShowAllMentions = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.anchorEl) {
        setAllMentionsAnchor(detail.anchorEl as HTMLElement);
      }
    };
    window.addEventListener("SHOW_ALL_MENTIONS", handleShowAllMentions);
    return () => window.removeEventListener("SHOW_ALL_MENTIONS", handleShowAllMentions);
  }, []);

  // Listen for individual @mention clicks — look up the member in
  // groupMembers and redirect to their chat (same as sender-name click /
  // onMemberRedirect). If the member has a ConversationId, open that chat.
  // If not, start a new chat with them via SELECT_NEW_CONVERSATION.
  // If the member isn't in groupMembers, fall back to SHOW_MEMBER_INFO.
  useEffect(() => {
    const handleMentionClick = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail) return;
      const mentionedUserId = String(detail.mentionedUserId);
      const mentionText = detail.mentionText || "";

      // Find the member in groupMembers by UserId
      const member = groupMembers.find(
        (m) => String(m.UserId) === mentionedUserId
      );

      if (member) {
        if (member.ConversationId) {
          // Open the user's existing chat
          window.dispatchEvent(
            new CustomEvent("SELECT_CONVERSATION", {
              detail: { conversationId: member.ConversationId },
            })
          );
        } else {
          // No existing conversation — open the contact profile so the
          // user can start a chat from there (same as sender-name click).
          window.dispatchEvent(
            new CustomEvent("SHOW_MEMBER_INFO", {
              detail: {
                id: member.UserId,
                UserId: member.UserId,
                UserName: member.MemberName || member.UserName || member.DisplayName,
                MemberName: member.MemberName,
                ProfileImageUrl: member.ProfileImage,
                IsGroup: 0,
              },
            })
          );
        }
      } else {
        // Member not found in groupMembers — fall back to SHOW_MEMBER_INFO
        // with whatever data we have from the mention metadata
        window.dispatchEvent(
          new CustomEvent("SHOW_MEMBER_INFO", {
            detail: {
              id: mentionedUserId,
              UserId: mentionedUserId,
              UserName: mentionText.replace(/^@/, ""),
              IsGroup: 0,
            },
          })
        );
      }
    };
    window.addEventListener("MENTION_CLICK", handleMentionClick);
    return () => window.removeEventListener("MENTION_CLICK", handleMentionClick);
  }, [groupMembers]);

  useEffect(() => {
    const convId = selectedCustomer?.ConversationId;
    // 1. Fast-sync admin state from selectedCustomer
    setIsCurrentUserAdmin(
      isGroup &&
        (selectedCustomer?.IsGroupAdmin === 1 || selectedCustomer?.IsGroupAdmin === true)
    );

    // 2. Clear group members immediately on conversation switch to prevent
    //    stale members from the previous group leaking into @mention dropdown.
    setGroupMembers([]);

    // 3. Sync RemoveInGroup context
    if (convId && selectedCustomer?.RemoveInGroup !== undefined) {
      updateRemoveInGroupStatus(convId, selectedCustomer.RemoveInGroup === 1);
    }

    // 4. Fetch group details for admin mode + current-user admin flag + members for mentions
    if (isGroup && convId && auth) {
      // Use .then() instead of async to avoid creating a new function on every render
      fetchAndCacheGroupMembers(convId)
        .then((groupData: any) => {
          // Guard: if the user switched to another conversation while fetching,
          // discard the result to avoid leaking old group data into the new one.
          if (selectedCustomer?.ConversationId !== convId) return;
          if (groupData?.groupDetails) {
            updateGroupAdminMode(convId, groupData.groupDetails.SendNewMessage === 0);
            const currentUser = groupData.members?.find(
              (m: any) => Number(m.UserId) === Number(currentUserId)
            );
            setIsCurrentUserAdmin((currentUser as any)?.IsGroupAdmin === 1);
          }
          // Store members for @mention feature
          if (groupData?.members) {
            setGroupMembers(groupData.members);
          }
        })
        .catch((error: unknown) => {
          console.error("Error fetching initial group status:", error);
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCustomer?.ConversationId, selectedCustomer?.IsGroup, auth]);

  // ── Favorite toggle (ported from old useMessageActions handleToggleFavorite) ──
  const handleToggleFavorite = useCallback(async () => {
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
        if (selectedCustomer) {
          (selectedCustomer as any).IsStar = newIsStar;
        }
        if (refresh) refresh();
      } else {
        updateFavoriteStatus(selectedCustomer.ConversationId, isFavorite ? 1 : 0);
        showToast("Failed to update favorite status", "error");
      }
    } catch {
      updateFavoriteStatus(selectedCustomer.ConversationId, isFavorite ? 1 : 0);
      showToast("Error updating favorite status", "error");
    }
  }, [selectedCustomer, auth, isFavorite, updateFavoriteStatus, refresh]);

  // ── Confirm modal (clear chat, exit group, delete chat) ───────────────────
  const {
    confirmationModal,
    open: openConfirmModal,
    close: closeConfirmModal,
    openDeleteMessage,
    checkAdminStatusAndShowConfirmation,
    onConfirm: handleConfirm,
    getDeleteMessageActions,
  } = useConfirmModal({
    selectedCustomer,
    auth: auth as any,
    onCustomerSelect: onCustomerSelect as any,
    refresh,
    handleDeleteMessage,
    fetchAndCacheGroupMembers,
    isCurrentUserAdmin: !!isCurrentUserAdmin,
    getGroupPermission: (convId: string | number, perm: string) =>
      getGroupPermission(convId, perm),
  });

  // ── Group socket listeners (system messages for member/permission events) ──
  const { registerListener, unregisterListener } = useGroupSocket();
  useGroupSocketListeners({
    selectedCustomer,
    auth: auth as AuthData,
    refresh,
    updateRemoveInGroupStatus,
    updateGroupAdminMode,
    setIsCurrentUserAdmin,
    registerListener,
    unregisterListener,
    addUniqueMessage,
    onCustomerSelect: onCustomerSelect as any,
  });

  // ── Header menu action handler ────────────────────────────────────────────
  const handleMenuAction = useCallback(
    async (action: string) => {
      setMenuAnchor(null);
      if (action === "groupInfo") {
        openInfo();
      } else if (action === "close") {
        onCustomerSelect?.(null as any);
      } else if (action === "mute") {
        if (isCurrentlyMuted) {
          // Already muted → unmute directly
          await handleUnmuteConversation();
        } else {
          // Not muted → open dialog to pick duration
          setMuteDialogOpen(true);
        }
      } else if (action === "favourite") {
        await handleToggleFavorite();
      } else if (action === "selectMessages") {
        showToast("Select messages — coming soon!", "info");
      } else if (action === "clearChat") {
        openConfirmModal("clearChat");
      } else if (action === "exitGroup") {
        await checkAdminStatusAndShowConfirmation();
      } else if (action === "deleteGroup" || action === "deleteChat") {
        openConfirmModal(action);
      }
    },
    [onCustomerSelect, handleToggleFavorite, checkAdminStatusAndShowConfirmation, openConfirmModal, isCurrentlyMuted]
  );

  // ── Mute / unmute conversation ──────────────────────────────────────────
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

  const handleUnmuteConversation = useCallback(
    async () => {
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
    },
    [selectedCustomer, auth, onCustomerSelect]
  );

  // ── Header menu ──────────────────────────────────────────────────────────
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [contextMenu, setContextMenu] = useState<{ mouseX: number; mouseY: number; msg: ChatMessage } | null>(null);
  const [chatAreaMenu, setChatAreaMenu] = useState<{ mouseX: number; mouseY: number } | null>(null);

  const handleMoreClick = useCallback((e: React.MouseEvent<HTMLElement>) => {
    setMenuAnchor(e.currentTarget);
  }, []);

  const handleMenuClose = useCallback(() => {
    setMenuAnchor(null);
  }, []);

  // ── Search: opens the CustomerDetails panel in "search" view ──────────────
  // (The panel hosts the search input + results list, matching the old app.)
  const handleSearch = useCallback(() => {
    if (drawerOpen && drawerViewState === "search") {
      closeDrawer();
    } else {
      openSearch();
    }
  }, [drawerOpen, drawerViewState, openSearch, closeDrawer]);

  // ── Search by date from the search panel (mobile) ─────────────────────────
  // On mobile, close the search panel after selecting a date so the user
  // sees the jumped-to messages in the chat.
  const handleSearchByDateFromPanel = useCallback(
    (date: string) => {
      searchByDate?.(date);
      closeDrawer();
    },
    [searchByDate, closeDrawer]
  );

  // ── Context menu for messages ─────────────────────────────────────────────
  const handleContextMenu = useCallback((e: React.MouseEvent, msg: ChatMessage) => {
    e.preventDefault();
    setContextMenu({ mouseX: e.clientX + 2, mouseY: e.clientY + 2, msg });
  }, []);

  const handleMenuClick = useCallback((e: React.MouseEvent, _msg: ChatMessage) => {
    // Could open a different menu here
  }, []);

  // ── Stable callbacks for MessageList (prevents re-render on every keystroke) ─
  const handleQuickReaction = useCallback(
    (emoji: string, msg: ChatMessage) => handleMessageEmojiClick(emoji, msg),
    [handleMessageEmojiClick]
  );
  const handleRemoveReactionCb = useCallback(
    (reaction: { Emoji?: string; Reaction?: string; UserId?: number | string }, msg: ChatMessage) =>
      handleRemoveReaction(reaction, msg),
    [handleRemoveReaction]
  );
  const handleContainerRef = useCallback((el: HTMLDivElement | null) => {
    containerRef.current = el;
  }, []);

  // Stable input change handler — prevents ChatInput re-render on every keystroke.
  // Only updates the ref (for draft saving). setInputValue is NOT called here
  // because it would create a feedback loop:
  //   type → onChange → setInputValue → re-render → ExternalValueSyncPlugin
  //   sees changed value → re-imports → triggers update → onChange → ...
  // setInputValue is only called when loading a draft or clearing input.
  const handleInputChange = useCallback(
    (val: string) => {
      updateLatestInput(val);
    },
    [updateLatestInput]
  );

  // Stable fetch members handler — guards against race conditions by
  // checking that the conversation hasn't changed by the time the fetch resolves.
  const handleFetchMembers = useCallback(() => {
    if (isGroup && selectedCustomer?.ConversationId) {
      const convId = selectedCustomer.ConversationId;
      fetchAndCacheGroupMembers(convId).then(
        (res) => {
          // Discard result if the user switched conversations while fetching
          if (selectedCustomer?.ConversationId !== convId) return;
          if (res?.members) setGroupMembers(res.members as typeof groupMembers);
        }
      );
    }
  }, [isGroup, selectedCustomer?.ConversationId, fetchAndCacheGroupMembers]);

  const handleContextClose = useCallback(() => {
    setContextMenu(null);
  }, []);

  const handleChatAreaContextMenu = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (!target.closest(".messages-area") || target.closest(".message-bubble-wrapper")) return;
    e.preventDefault();
    setChatAreaMenu({ mouseX: e.clientX + 2, mouseY: e.clientY + 2 });
  }, []);

  const handleChatAreaMenuClose = useCallback(() => {
    setChatAreaMenu(null);
  }, []);

  const handleChatAreaClose = useCallback(() => {
    setChatAreaMenu(null);
    onCustomerSelect?.(null as any);
  }, [onCustomerSelect]);

  // ── Close chat on Escape ─────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedCustomer) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCustomerSelect?.(null as any);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedCustomer, onCustomerSelect]);

  // ── Send handler with scroll ─────────────────────────────────────────────
  const handleSendWithScroll = useCallback(
    (text: string, mentions?: import("./input/MentionPlugin").MentionData[]) => {
      handleSendMessage(
        () => {
          // If we're in a historical/search view (hasMoreAfter=true), jump
          // to the latest messages after sending — otherwise the user stays
          // stuck in the old message view and the conversation appears
          // unselected when they close the search panel.
          if (hasMoreAfter) {
            jumpToLatest();
          } else {
            messageListRef.current?.scrollToBottom("smooth");
          }
        },
        text,
        mentions
      );
    },
    [handleSendMessage, hasMoreAfter, jumpToLatest]
  );

  // ── Empty state ──────────────────────────────────────────────────────────

  if (!selectedCustomer) {
    return (
      <Box className="chat-panel chat-panel--empty">
        <MessageSquare size={56} style={{ opacity: 0.2 }} />
        <Typography variant="h6" className="chat-panel__empty-title">
          Select a conversation
        </Typography>
        <Typography variant="body2" className="chat-panel__empty-subtitle">
          Choose a chat from the list to start messaging
        </Typography>
      </Box>
    );
  }

  return (
    <Box className="chat-panel-wrapper">
      {/* Chat content (flex column: header + messages + input) */}
      <Box
        className={`chat-panel${mediaFiles.length > 0 ? " media-preview-open" : ""}`}
        onContextMenu={handleChatAreaContextMenu}
      >
      <ChatHeader
        selectedCustomer={selectedCustomer}
        typingStatus={typingStatus}
        loading={loading}
        onRefresh={refresh}
        onSearch={handleSearch}
        onMore={handleMoreClick}
        onOpenInfo={openInfo}
        onBack={onBack}
        starFilter={starFilter}
        onToggleStarFilter={handleToggleStarFilter}
        starNewMessageCount={starNewMessageCount}
        onSearchByDate={searchByDate ?? undefined}
      />

      <MessageList
        ref={messageListRef}
        rows={flattenedRows}
        loading={loading}
        loadingOlder={loadingOlder}
        loadingNewer={loadingNewer}
        selectedCustomer={selectedCustomer}
        blinkMessageId={blinkMessageId}
        searchHighlightQuery={searchHighlightQuery}
        searchHighlightMessageId={searchHighlightMessageId}
        typingStatus={typingStatus}
        getMessageStatusIcon={getMessageStatusIcon}
        onContextMenu={handleContextMenu}
        onMenuClick={handleMenuClick}
        onForward={handleForward}
        onQuickReaction={handleQuickReaction}
        onRemoveReaction={handleRemoveReactionCb}
        onMediaClick={handleMediaClick}
        getMediaKey={getMediaKey}
        loadedMedia={loadedMedia}
        markLoaded={markLoaded}
        getMediaSrcForMessage={getMediaSrcForMessage}
        messageById={messageById}
        onScrollToTop={loadOlderMessages}
        hasMoreBefore={hasMoreBefore}
        hasMoreAfter={hasMoreAfter}
        pendingNewMessages={pendingNewMessages}
        isAtBottomRef={isAtBottomRef}
        onFlushNewMessages={flushNewMessages}
        onLoadNewer={loadNewerMessages}
        onJumpToLatest={jumpToLatest}
        isAutoLoadingNewerRef={autoLoadNewerRef}
        olderError={olderError}
        newerError={newerError}
        onRetryOlder={retryLoadOlder}
        onRetryNewer={retryLoadNewer}
        unreadAnchorMessageId={unreadAnchorMessageId}
        unreadCount={unreadCount}
        scrollRestoreKey={selectedCustomer?.ConversationId ?? undefined}
        processFiles={processFiles}
        onContainerRef={handleContainerRef}
        auth={auth}
        scrollToMessageProp={scrollToMessage}
        isMediaPreviewOpen={mediaFiles.length > 0}
        scrollToBottomRightOffset={scrollToBottomRightOffset}
      />

      <ChatInput
        onSend={handleSendWithScroll}
        placeholder="Type a message..."
        syncKey={selectedCustomer?.ConversationId ?? undefined}
        replyToMessage={replyToMessage}
        onCancelReply={handleCancelReply}
        mediaFiles={mediaFiles}
        onAttachClick={handleAttachClick}
        showMedia={showMedia}
        onFileChange={handleFileChange}
        onProcessFiles={processFiles}
        onRemoveMedia={(idx) => {
          const next = mediaFiles.filter((_, i) => i !== idx);
          setMediaFiles(next);
        }}
        onClearMedia={() => setMediaFiles([])}
        darkMode={resolvedMode === "dark"}
        onTypingChange={onTypingChange}
        isRemovedFromGroup={!!isRemovedFromCurrentGroup}
        isOnlyAdminSend={isOnlyAdminSend}
        isCurrentUserAdmin={!!isCurrentUserAdmin}
        mentionMembers={isGroup ? groupMembers : []}
        excludeUserId={currentUserId}
        inputValue={inputValue}
        onInputChange={handleInputChange}
        onFetchMembers={handleFetchMembers}
        isGroup={isGroup}
      />

      {/* Media Preview overlay (shows when files are attached) */}
      <MediaPreview
        open={mediaFiles.length > 0}
        mediaFiles={mediaFiles}
        onClose={() => setMediaFiles([])}
        onSend={(caption) => {
          handleSendWithScroll(caption);
          setMediaFiles([]);
        }}
        onRemoveMedia={(idx) => {
          const next = mediaFiles.filter((_, i) => i !== idx);
          setMediaFiles(next);
        }}
        onAddMore={(files) => {
          // Add more files to existing selection
          processFiles(files);
        }}
        syncKey={selectedCustomer?.ConversationId ?? undefined}
      />

      {/* Header more-options menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={handleMenuClose}
        transitionDuration={0}
        slotProps={{
          paper: {
            sx: {
              borderRadius: "16px",
              minWidth: "200px",
              // Glassmorphic surface
              bgcolor: (t: { palette: { mode: string } }) =>
                t.palette.mode === "dark"
                  ? "rgba(35, 35, 51, 0.82)"
                  : "rgba(255, 255, 255, 0.82)",
              backdropFilter: "blur(20px) saturate(180%)",
              WebkitBackdropFilter: "blur(20px) saturate(180%)",
              boxShadow: (t: { palette: { mode: string } }) =>
                t.palette.mode === "dark"
                  ? "0 12px 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)"
                  : "0 12px 40px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.4)",
              border: (t: { palette: { mode: string } }) =>
                t.palette.mode === "dark"
                  ? "1px solid rgba(255,255,255,0.08)"
                  : "1px solid rgba(255,255,255,0.5)",
              mt: 1.5,
              overflow: "hidden",
              "& .MuiMenuItem-root": {
                px: 1.5,
                py: 1.25,
                mx: 1,
                borderRadius: "10px",
                transition: "all 0.2s ease",
                gap: "12px",
                minHeight: "44px",
                "&:hover": {
                  bgcolor: "primary.main",
                  color: "#fff",
                  "& .MuiListItemIcon-root": { color: "#fff" },
                },
              },
              "& .MuiListItemIcon-root": {
                color: "text.secondary",
                transition: "all 0.2s ease",
                minWidth: "auto !important",
              },
              "& .MuiTypography-root": {
                fontWeight: 500,
                fontSize: "0.875rem",
              },
            },
          },
        }}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <MenuItem onClick={() => handleMenuAction("groupInfo")}>
          <ListItemIcon><Info size={18} /></ListItemIcon>
          <ListItemText primary={isGroup ? "Group Info" : "Contact Info"} />
        </MenuItem>
        <MenuItem onClick={() => handleMenuAction("selectMessages")}>
          <ListItemIcon><CheckSquare size={18} /></ListItemIcon>
          <ListItemText primary="Select messages" />
        </MenuItem>
        <MenuItem onClick={() => handleMenuAction("mute")}>
          <ListItemIcon>{isCurrentlyMuted ? <Bell size={18} /> : <BellOff size={18} />}</ListItemIcon>
          <ListItemText primary={isCurrentlyMuted ? "Unmute notification" : "Mute notification"} />
        </MenuItem>
        <MenuItem onClick={() => handleMenuAction("favourite")}>
          <ListItemIcon>
            <Star
              size={18}
              fill={isFavorite ? "#FFD700" : "none"}
              color={isFavorite ? "#FFD700" : "currentColor"}
            />
          </ListItemIcon>
          <ListItemText primary={isFavorite ? "Remove from favourite" : "Add to favourite"} />
        </MenuItem>
        <MenuItem onClick={() => handleMenuAction("close")}>
          <ListItemIcon><X size={18} /></ListItemIcon>
          <ListItemText primary="Close chat" />
        </MenuItem>
        <Divider sx={{ my: 0.5 }} />
        <MenuItem onClick={() => handleMenuAction("clearChat")}>
          <ListItemIcon><CircleMinus size={18} /></ListItemIcon>
          <ListItemText primary="Clear chat" />
        </MenuItem>
        {isGroup ? (
          isRemovedFromCurrentGroup ? (
            <MenuItem onClick={() => handleMenuAction("deleteGroup")} sx={{ color: "error.main" }}>
              <ListItemIcon sx={{ color: "error.main" }}><Trash2 size={18} /></ListItemIcon>
              <ListItemText primary="Delete group" />
            </MenuItem>
          ) : (
            <MenuItem onClick={() => handleMenuAction("exitGroup")} sx={{ color: "error.main" }}>
              <ListItemIcon sx={{ color: "error.main" }}><LogOut size={18} /></ListItemIcon>
              <ListItemText primary="Exit group" />
            </MenuItem>
          )
        ) : (
          <MenuItem onClick={() => handleMenuAction("deleteChat")} sx={{ color: "error.main" }}>
            <ListItemIcon sx={{ color: "error.main" }}><Trash2 size={18} /></ListItemIcon>
            <ListItemText primary="Delete chat" />
          </MenuItem>
        )}
      </Menu>

      {/* Message context menu */}
      <MessageContextMenu
        open={Boolean(contextMenu)}
        onClose={handleContextClose}
        message={contextMenu?.msg ?? null}
        mouseX={contextMenu?.mouseX ?? null}
        mouseY={contextMenu?.mouseY ?? null}
        selectedCustomer={selectedCustomer}
        onReply={(msg) => handleReply(msg)}
        onForward={(msg) => handleForward(msg)}
        onEdit={(msg) => handleEditAction(msg)}
        onDelete={(msg) => openDeleteMessage(msg)}
        onStar={(msg) => handleStarMessage(msg)}
        onMessageInfo={(msg) => {
          openMessageInfo(msg);
        }}
        canDelete={(() => {
          if (selectedCustomer?.IsGroup !== 1) return true;
          if (!!isCurrentUserAdmin) return true;
          const perm = getGroupPermission(selectedCustomer?.ConversationId ?? "", "AllowDeleteForAll");
          if (perm !== undefined) return perm === 1;
          return (selectedCustomer as any)?.AllowDeleteForAll === 1 || (selectedCustomer as any)?.AllowDeleteForAll === true;
        })()}
        onMemberRedirect={(msg) => {
          const member = msg as any;
          if (member) {
            if (member.ConversationId) {
              window.dispatchEvent(
                new CustomEvent("SELECT_CONVERSATION", {
                  detail: { conversationId: member.ConversationId },
                })
              );
            } else {
              window.dispatchEvent(
                new CustomEvent("SELECT_NEW_CONVERSATION", {
                  detail: {
                    customer: {
                      ...member,
                      UserId: member.UserId,
                      name: member.Name || member.MemberName,
                      ProfileImageUrl: member.ProfileImageUrl || member.ProfileImage,
                      IsGroup: 0,
                    },
                  },
                })
              );
            }
          }
        }}
      />

      {/* Chat area right-click menu */}
      <Menu
        open={Boolean(chatAreaMenu)}
        onClose={handleChatAreaMenuClose}
        anchorReference="anchorPosition"
        anchorPosition={
          chatAreaMenu
            ? { top: chatAreaMenu.mouseY, left: chatAreaMenu.mouseX }
            : undefined
        }
        transitionDuration={0}
        slotProps={{
          paper: {
            sx: {
              borderRadius: "16px",
              minWidth: "180px",
              bgcolor: (t: { palette: { mode: string } }) =>
                t.palette.mode === "dark"
                  ? "rgba(35, 35, 51, 0.82)"
                  : "rgba(255, 255, 255, 0.82)",
              backdropFilter: "blur(20px) saturate(180%)",
              WebkitBackdropFilter: "blur(20px) saturate(180%)",
              boxShadow: (t: { palette: { mode: string } }) =>
                t.palette.mode === "dark"
                  ? "0 12px 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)"
                  : "0 12px 40px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.4)",
              border: (t: { palette: { mode: string } }) =>
                t.palette.mode === "dark"
                  ? "1px solid rgba(255,255,255,0.08)"
                  : "1px solid rgba(255,255,255,0.5)",
              mt: 1.5,
              overflow: "hidden",
              "& .MuiMenuItem-root": {
                px: 1.5,
                py: 1.25,
                mx: 1,
                borderRadius: "10px",
                transition: "all 0.2s ease",
                gap: "12px",
                minHeight: "44px",
                "&:hover": {
                  bgcolor: "primary.main",
                  color: "#fff",
                  "& .MuiListItemIcon-root": { color: "#fff" },
                },
              },
              "& .MuiListItemIcon-root": {
                color: "text.secondary",
                transition: "all 0.2s ease",
                minWidth: "auto !important",
              },
              "& .MuiTypography-root": {
                fontWeight: 500,
                fontSize: "0.875rem",
              },
            },
          },
        }}
      >
        <MenuItem onClick={handleChatAreaClose}>
          <ListItemIcon><X size={18} /></ListItemIcon>
          <ListItemText primary="Close chat" />
        </MenuItem>
      </Menu>

      {/* Media Viewer (fullscreen lightbox) */}
      <MediaViewer
        open={mediaViewerOpen}
        items={mediaViewerItems}
        initialIndex={mediaViewerIndex}
        message={mediaViewerMessage}
        messages={messages}
        selectedCustomer={selectedCustomer}
        currentUserId={currentUserId}
        onClose={handleClosePreview}
        onReply={handleReply}
        onForward={handleForward}
        onQuickReaction={(emoji, msg) => handleMessageEmojiClick(emoji, msg)}
        onRemoveReaction={(reaction, msg) => handleRemoveReaction(reaction, msg)}
      />

      {/* Edit Message Dialog */}
      <EditMessageDialog
        open={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        onSave={(messageId, newMessage, mentions) => {
          handleEditMessage(messageId, newMessage, mentions);
          setEditDialogOpen(false);
        }}
        originalMessage={selectedMessageForEdit}
        isGroup={isGroup}
        mentionMembers={isGroup ? groupMembers : []}
        excludeUserId={currentUserId}
        onFetchMembers={handleFetchMembers}
      />

      {/* Replace or Add Media Dialog */}
      <Dialog
        open={replaceAddDialog.open}
        onClose={() => setReplaceAddDialog({ open: false, newFiles: null, existingCount: 0 })}
        maxWidth="xs"
        fullWidth
        slotProps={{
          paper: {
            sx: {
              borderRadius: 3,
              p: 1,
            },
          },
        }}
      >
        <DialogTitle sx={{ fontWeight: 600, fontSize: "1.1rem" }}>
          Replace or Add Files?
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            You already have {replaceAddDialog.existingCount} file{replaceAddDialog.existingCount !== 1 ? "s" : ""} in the preview.
            Do you want to replace them with the new file{replaceAddDialog.newFiles?.length !== 1 ? "s" : ""}, or add to the existing ones?
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, pt: 1, gap: 1 }}>
          <Button
            onClick={() => setReplaceAddDialog({ open: false, newFiles: null, existingCount: 0 })}
            color="inherit"
            sx={{ borderRadius: 2, textTransform: "none" }}
          >
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (replaceAddDialog.newFiles) {
                const fileObjects = replaceAddDialog.newFiles.map((m: any) => m.file).filter(Boolean);
                if (fileObjects.length) processFiles(fileObjects, "replace");
              }
              setReplaceAddDialog({ open: false, newFiles: null, existingCount: 0 });
            }}
            variant="outlined"
            sx={{ borderRadius: 2, textTransform: "none" }}
          >
            Replace
          </Button>
          <Button
            onClick={() => {
              if (replaceAddDialog.newFiles) {
                const fileObjects = replaceAddDialog.newFiles.map((m: any) => m.file).filter(Boolean);
                if (fileObjects.length) processFiles(fileObjects, "add");
              }
              setReplaceAddDialog({ open: false, newFiles: null, existingCount: 0 });
            }}
            variant="contained"
            sx={{ borderRadius: 2, textTransform: "none" }}
          >
            Add
          </Button>
        </DialogActions>
      </Dialog>

      {/* Forward Message Panel */}
      <ForwardMessage
        open={Boolean(forwardMessage)}
        message={forwardMessage}
        anchorEl={forwardAnchorEl}
        onClose={handleCloseForward}
        onSend={handleSendForward}
        isCentered={!forwardAnchorEl}
      />

      {/* Confirmation Dialog (clear chat, exit group, delete chat, delete message) */}
      <ConfirmationDialog
        isOpen={confirmationModal.isOpen}
        onClose={closeConfirmModal}
        onConfirm={() => {
          if (handleConfirm) handleConfirm();
        }}
        title={confirmConfig[confirmationModal.actionType]?.title ?? ""}
        description={confirmConfig[confirmationModal.actionType]?.description ?? ""}
        confirmText={confirmConfig[confirmationModal.actionType]?.confirmText ?? "Confirm"}
        variant={confirmConfig[confirmationModal.actionType]?.variant ?? "primary"}
        showCancel={confirmConfig[confirmationModal.actionType]?.showCancel ?? true}
        actions={
          confirmationModal.actionType === "deleteMessage"
            ? getDeleteMessageActions().map((a) => ({
                label: a.label,
                onClick: a.onClick,
                danger: a.danger,
                variant: a.variant,
                autoClose: false,
              }))
            : undefined
        }
      />

      {/* @all mentions popover — shows all group members when @all is clicked */}
      <Popover
        open={Boolean(allMentionsAnchor)}
        anchorEl={allMentionsAnchor}
        onClose={() => setAllMentionsAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
        slotProps={{
          paper: {
            sx: {
              width: 320,
              maxHeight: 320,
              borderRadius: "16px !important",
              border: "none !important",
              boxShadow: "0 2px 8px rgba(0,0,0,0.1), 0 4px 16px rgba(0,0,0,0.08) !important",
              py: 1,
              overflowY: "auto",
              "&::-webkit-scrollbar": { width: 5 },
              "&::-webkit-scrollbar-thumb": {
                backgroundColor: alpha(theme.palette.text.primary, 0.2),
                borderRadius: 3,
              },
              "&::-webkit-scrollbar-track": { background: "transparent" },
            },
          },
        }}
      >
        <MentionListContent
          members={groupMembers as MentionMember[]}
          onSelect={(member) => {
            if (member.ConversationId) {
              // Open the member's existing chat
              window.dispatchEvent(
                new CustomEvent("SELECT_CONVERSATION", {
                  detail: { conversationId: member.ConversationId },
                })
              );
            } else {
              // No existing conversation — start a new chat
              window.dispatchEvent(
                new CustomEvent("SELECT_NEW_CONVERSATION", {
                  detail: {
                    customer: {
                      UserId: member.UserId,
                      id: member.UserId,
                      name: member.MemberName || member.UserName || member.DisplayName,
                      UserName: member.MemberName || member.UserName || member.DisplayName,
                      MemberName: member.MemberName,
                      ProfileImageUrl: member.ProfileImage,
                      IsGroup: 0,
                    },
                  },
                })
              );
            }
            setAllMentionsAnchor(null);
          }}
        />
      </Popover>

      {/* ── Customer Details panel (contact/group info + search) ───────────────
       * On narrow screens (<= 1024px) it renders as a drawer overlay (fixed
       * position, slides in from the right).
       * On wider screens it renders as a docked side panel (variant="panel")
       * sitting next to the chat area in the horizontal flex row.
       */}
      </Box>
      {drawerOpen && selectedCustomer && (
        <CustomerDetails
          customer={(infoMember || selectedCustomer) as ConversationListEntry}
          onClose={closeDrawer}
          open={drawerOpen}
          variant={isNarrowScreen ? "drawer" : "panel"}
          initialViewState={drawerViewState}
          messageInfo={selectedMessageForInfo}
          messages={messages}
          scrollToMessage={scrollToMessage}
          searchResults={searchResults}
          isSearching={isSearching}
          onSearchMessages={searchMessages}
          onSearchByDate={isNarrowScreen ? handleSearchByDateFromPanel : searchByDate}
          containerRef={containerRef}
        />
      )}

      {/* Mute Notification Dialog */}
      <MuteNotificationDialog
        open={muteDialogOpen}
        onClose={() => !muteLoading && setMuteDialogOpen(false)}
        onConfirm={handleMuteConversation}
        conversationName={selectedCustomer?.name as string}
        isGroup={isGroup}
        loading={muteLoading}
      />
    </Box>
  );
});

ChatPanel.displayName = "ChatPanel";

export default ChatPanel;
