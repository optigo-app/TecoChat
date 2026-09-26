"use client";

import { useCallback, useState, useRef, useEffect, memo } from "react";
import { Box, Typography, IconButton } from "@mui/material";
import { MessageSquare } from "lucide-react";
import dynamic from "next/dynamic";
import { MessageContextMenu } from "./messages/interactions";
import { useLoginContext, type AuthData } from "../../contexts/LoginData";
import { useSocketContext } from "../../contexts/SocketContext";
import { useOnlineStatus } from "../../hooks/useOnlineStatus";
import { useConversation } from "../../hooks/useConversation";
import { useColorMode } from "../../theme/ThemeRegistry";
import { useFavorite } from "../../contexts/FavoriteContext";
import { useRemoveInGroup } from "../../contexts/RemoveInGroupContext";
import { useGroupAdminMode } from "../../contexts/GroupAdminModeContext";
import { useConfirmModal } from "../../hooks/useConfirmModal";
import { useDrawerState } from "../../hooks/Conversaction/useDrawerState";
import { useGroupSocketListeners } from "../../hooks/Conversaction/useGroupSocketListeners";
import { useMuteConversation } from "../../hooks/Conversaction/useMuteConversation";
import { useToggleFavorite } from "../../hooks/Conversaction/useToggleFavorite";
import { useGroupSocket } from "../../contexts/GroupSocketContext";
import { useBreakpointDown, useIsMobile } from "../../hooks/useIsMobile";
import { showToast } from "../../utils/toastHelper";
import { ChatHeader } from "./ChatHeader";
import { HeaderMenu } from "./HeaderMenu";
import { ChatAreaMenu } from "./ChatAreaMenu";
import { JumpToDatePicker } from "./JumpToDatePicker";
import { ReplaceAddMediaDialog } from "./ReplaceAddMediaDialog";
import { AllMentionsPopover } from "./AllMentionsPopover";
import MessageList, { type MessageListRef } from "./MessageList";
import { ChatInput } from "./ChatInput";
const MediaViewer = dynamic(() => import("./messages/viewer/MediaViewer"), { ssr: false });
const PdfViewerDialog = dynamic(() => import("./messages/viewer/PdfViewerDialog"), { ssr: false });
const TxtViewerDialog = dynamic(() => import("./messages/viewer/TxtViewerDialog"), { ssr: false });
import MediaPreview from "./messages/MediaPreview";
import EditMessageDialog from "./EditMessageDialog";
import MuteNotificationDialog from "./MuteNotificationDialog";
import { isConversationMuted } from "../../utils/mentionUtils";
import ForwardMessage from "../ForwardMessage/ForwardMessage";
import ConfirmationDialog from "../ReusableComponent/ConfirmationDialog";
import CustomerDetails from "../CustomerDetails/CustomerDetails";
import { CONFIRM_CONFIG as confirmConfig } from "../../hooks/confirmConfig";
import type { ConversationListEntry } from "../../types/conversation";
import type { ChatMessage } from "../../types/message";
import type { MediaFileItem } from "./CoreLogic/uiReducer";
import "./ChatPanel.scss";

interface ChatPanelProps {
  selectedCustomer: ConversationListEntry | null;
  onConversationRead?: ((read: boolean) => void) | null;
  onCustomerSelect?: ((customer: ConversationListEntry | null) => void) | null;
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
  const { resolvedMode } = useColorMode();
  const { auth } = useLoginContext();
  const messageListRef = useRef<MessageListRef>(null);
  const containerRef = useRef<HTMLElement | null>(null);
  const selectedCustomerRef = useRef(selectedCustomer);
  useEffect(() => {
    selectedCustomerRef.current = selectedCustomer;
  }, [selectedCustomer]);

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
  const isMobile = useIsMobile(); // <= 768px
  const { status: socketStatus } = useSocketContext();
  const isOnline = useOnlineStatus();
  const isOffline = !isOnline || socketStatus !== "connected";

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
    pdfViewerOpen,
    pdfViewerItem,
    txtViewerOpen,
    txtViewerItem,
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
    handleClosePdfViewer,
    handleCloseTxtViewer,
    handleSendMessage,
    handleReply,
    handleCancelReply,
    retryFailedMessage,
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
  const isCurrentlyMuted = isConversationMuted(
    (selectedCustomer as any)?.IsMuted,
    (selectedCustomer as any)?.MuteExpiresAt
  );
  const {
    muteDialogOpen,
    setMuteDialogOpen,
    muteLoading,
    handleMuteConversation,
    handleUnmuteConversation,
  } = useMuteConversation({
    selectedCustomer,
    auth: auth as any,
    onCustomerSelect: onCustomerSelect as any,
  });

  const contextAdminMode = isGroupOnlyAdminSend(selectedCustomer?.ConversationId ?? "");
  const isOnlyAdminSend =
    contextAdminMode !== null && contextAdminMode !== undefined
      ? contextAdminMode
      : (selectedCustomer?.IsGroupAdmin === 1);

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
    setIsCurrentUserAdmin(
      isGroup &&
        (selectedCustomer?.IsGroupAdmin === 1 || selectedCustomer?.IsGroupAdmin === true)
    );

    setGroupMembers([]);

    if (convId && selectedCustomer?.RemoveInGroup !== undefined) {
      updateRemoveInGroupStatus(convId, selectedCustomer.RemoveInGroup === 1);
    }

    if (isGroup && convId && auth) {
      fetchAndCacheGroupMembers(convId)
        .then((groupData: any) => {
          if (selectedCustomerRef.current?.ConversationId !== convId) return;
          if (groupData?.groupDetails) {
            updateGroupAdminMode(convId, groupData.groupDetails.SendNewMessage === 0);
            const currentUser = groupData.members?.find(
              (m: any) => Number(m.UserId) === Number(currentUserId)
            );
            setIsCurrentUserAdmin((currentUser as any)?.IsGroupAdmin === 1);
          }
          if (groupData?.members) {
            setGroupMembers(groupData.members);
          }
        })
        .catch((error: unknown) => {
          console.error("Error fetching initial group status:", error);
        });
    }
  }, [selectedCustomer?.ConversationId, selectedCustomer?.IsGroup, auth]);

  const handleToggleFavorite = useToggleFavorite({
    selectedCustomer,
    auth: auth as any,
    isFavorite: !!isFavorite,
    updateFavoriteStatus,
    refresh,
  });

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
        onCustomerSelect?.(null);
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

  // Closing the drawer also exits starred mode — the header star icon
  // shouldn't stay lit while its panel is closed.
  const handleCloseDrawer = useCallback(() => {
    if (starFilter) handleToggleStarFilter();
    closeDrawer();
  }, [starFilter, handleToggleStarFilter, closeDrawer]);

  const handleSearch = useCallback(() => {
    if (drawerOpen && drawerViewState === "search") {
      handleCloseDrawer();
    } else {
      openSearch();
    }
  }, [drawerOpen, drawerViewState, openSearch, handleCloseDrawer]);

  // Star click → open the search drawer in starred-messages mode (WhatsApp
  // "Starred messages"). Toggling off leaves the drawer as a normal search.
  const handleStarToggle = useCallback(() => {
    if (!starFilter) openSearch();
    handleToggleStarFilter();
  }, [starFilter, openSearch, handleToggleStarFilter]);

  // ── No-results date search — inline pill in the message area ────────────
  const [noResultsDate, setNoResultsDate] = useState<string | null>(null);

  const handleSearchByDateFromPanel = useCallback(
    async (date: string) => {
      messageListRef.current?.setSkipNextAutoScroll();
      const found = await searchByDate?.(date);
      closeDrawer();
      if (found) {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            messageListRef.current?.scrollToTop();
          });
        });
      } else {
        setNoResultsDate(date);
        // Auto-hide after 4 seconds
        setTimeout(() => setNoResultsDate(null), 4000);
      }
    },
    [searchByDate, closeDrawer]
  );

  // Wrapper for desktop (non-narrow) date search — also scrolls to top.
  const handleSearchByDate = useCallback(
    async (date: string) => {
      messageListRef.current?.setSkipNextAutoScroll();
      const found = await searchByDate?.(date);
      if (found) {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            messageListRef.current?.scrollToTop();
          });
        });
      } else {
        setNoResultsDate(date);
        setTimeout(() => setNoResultsDate(null), 4000);
      }
    },
    [searchByDate]
  );

  const [datePickerOpen, setDatePickerOpen] = useState(false);
  // Anchor ref for the header calendar button — the DatePicker popup opens
  // relative to this element so it appears near the header, not at the bottom.
  const datePickerButtonRef = useRef<HTMLButtonElement | null>(null);

  const toApiDate = (date: Date | null): string => {
    if (!date) return "";
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  const handleDateAccept = useCallback(
    (value: Date | null) => {
      const apiDate = toApiDate(value);
      setDatePickerOpen(false);
      if (apiDate) {
        handleSearchByDate(apiDate);
      }
    },
    [handleSearchByDate]
  );

  const openDatePicker = useCallback(() => {
    setMenuAnchor(null);
    setDatePickerOpen(true);
  }, []);

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

  const handleInputChange = useCallback(
    (val: string) => {
      updateLatestInput(val);
    },
    [updateLatestInput]
  );

  const handleFetchMembers = useCallback(() => {
    if (isGroup && selectedCustomer?.ConversationId) {
      const convId = selectedCustomer.ConversationId;
      fetchAndCacheGroupMembers(convId).then(
        (res) => {
          // Discard result if the user switched conversations while fetching
          if (selectedCustomerRef.current?.ConversationId !== convId) return;
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
    onCustomerSelect?.(null);
  }, [onCustomerSelect]);

  // ── Close chat on Escape ─────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedCustomer) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // Don't close chat when media preview is open — let it handle Esc
        if (mediaFiles.length > 0) return;
        onCustomerSelect?.(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedCustomer, onCustomerSelect, mediaFiles.length]);

  // ── Send handler with scroll ─────────────────────────────────────────────
  const handleSendWithScroll = useCallback(
    (
      text: string,
      mentions?: import("./input/MentionPlugin").MentionData[],
      overrideMediaFiles?: MediaFileItem[]
    ) => {
      handleSendMessage(
        () => {
          if (hasMoreAfter) {
            jumpToLatest();
          } else {
            messageListRef.current?.scrollToBottom("smooth");
          }
        },
        text,
        mentions,
        overrideMediaFiles
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
        loading={loading}
        onRefresh={refresh}
        onSearch={handleSearch}
        onMore={handleMoreClick}
        onOpenInfo={openInfo}
        onBack={onBack}
        starFilter={starFilter}
        onToggleStarFilter={handleStarToggle}
        starNewMessageCount={starNewMessageCount}
        onSearchByDate={handleSearchByDate}
        onOpenDatePicker={openDatePicker}
        isOffline={isOffline}
        datePickerButtonRef={datePickerButtonRef}
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
        onRetry={retryFailedMessage}
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
        noResultsDate={noResultsDate}
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
        isOffline={isOffline}
      />

      {/* Media Preview overlay (shows when files are attached) */}
      <MediaPreview
        open={mediaFiles.length > 0}
        mediaFiles={mediaFiles}
        onClose={() => setMediaFiles([])}
        onSend={(caption, exportedFiles) => {
          handleSendWithScroll(caption, undefined, exportedFiles);
          setMediaFiles([]);
        }}
        onRemoveMedia={(idx) => {
          const next = mediaFiles.filter((_, i) => i !== idx);
          setMediaFiles(next);
        }}
        onUpdateMedia={(index, file, preview) => {
          const previousPreview = mediaFiles[index]?.preview;
          if (previousPreview?.startsWith("blob:") && previousPreview !== preview) {
            URL.revokeObjectURL(previousPreview);
          }
          const next = mediaFiles.map((item, i) =>
            i === index ? { ...item, file, preview, size: file.size, name: file.name } : item
          );
          setMediaFiles(next);
        }}
        onAddMore={(files) => {
          // Add more files to existing selection
          processFiles(files);
        }}
        syncKey={selectedCustomer?.ConversationId ?? undefined}
      />

      {/* Header more-options menu */}
      <HeaderMenu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={handleMenuClose}
        isMobile={isMobile}
        isGroup={isGroup}
        isFavorite={!!isFavorite}
        isCurrentlyMuted={isCurrentlyMuted}
        isRemovedFromCurrentGroup={isRemovedFromCurrentGroup}
        starFilter={starFilter}
        onMenuAction={handleMenuAction}
        onOpenDatePicker={openDatePicker}
        onToggleStarFilter={handleStarToggle}
      />

      <JumpToDatePicker
        open={datePickerOpen}
        onClose={() => setDatePickerOpen(false)}
        onAccept={handleDateAccept}
        isMobile={isMobile}
        anchorEl={datePickerButtonRef.current}
      />

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
          const m = msg as any;
          // msg.ConversationId is the GROUP conversation — resolve the sender
          // in groupMembers to get their direct 1-1 conversation instead.
          const member = groupMembers.find(
            (gm) =>
              String(gm.UserId ?? "") === String(m.SenderId ?? "") ||
              String((gm as any).id ?? "") === String(m.SenderId ?? "") ||
              (m.SenderEmail && String(gm.UserId) === String(m.SenderEmail))
          );
          if (member?.ConversationId) {
            window.dispatchEvent(
              new CustomEvent("SELECT_CONVERSATION", {
                detail: {
                  conversationId: member.ConversationId,
                  // Fallback customer so page.tsx can open the chat even if
                  // the conversation isn't in the currently loaded list page.
                  customer: {
                    ConversationId: member.ConversationId,
                    id: member.UserId,
                    UserId: member.UserId,
                    ReceiverId: member.UserId,
                    name: member.MemberName || member.UserName || m.SenderInfo,
                    UserName: member.MemberName || member.UserName || m.SenderInfo,
                    ProfileImageUrl: member.ProfileImage || m.SenderProfilePicture,
                    IsGroup: 0,
                  },
                },
              })
            );
          } else {
            window.dispatchEvent(
              new CustomEvent("SELECT_NEW_CONVERSATION", {
                detail: {
                  customer: {
                    id: member?.UserId ?? m.SenderId,
                    UserId: member?.UserId ?? m.SenderId,
                    ReceiverId: member?.UserId ?? m.SenderId,
                    name: member?.MemberName || member?.UserName || m.SenderInfo || m.Sender,
                    UserName: member?.MemberName || member?.UserName || m.SenderInfo || m.Sender,
                    ProfileImageUrl: member?.ProfileImage || m.SenderProfilePicture,
                    IsGroup: 0,
                  },
                },
              })
            );
          }
        }}
      />

      {/* Chat area right-click menu */}
      <ChatAreaMenu
        open={Boolean(chatAreaMenu)}
        position={chatAreaMenu}
        onClose={handleChatAreaMenuClose}
        onCloseChat={handleChatAreaClose}
      />

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

      {/* PDF Viewer Dialog (dedicated full-screen PDF viewer with zoom) */}
      <PdfViewerDialog
        open={pdfViewerOpen}
        item={pdfViewerItem}
        message={mediaViewerMessage}
        messages={messages}
        selectedCustomer={selectedCustomer}
        onClose={handleClosePdfViewer}
        onReply={handleReply}
        onForward={handleForward}
        onQuickReaction={(emoji, msg) => handleMessageEmojiClick(emoji, msg)}
        onRemoveReaction={(reaction, msg) => handleRemoveReaction(reaction, msg)}
      />

      {/* Text Viewer Dialog (full-screen .txt / .log / .csv / .json preview) */}
      <TxtViewerDialog
        open={txtViewerOpen}
        item={txtViewerItem}
        message={mediaViewerMessage}
        messages={messages}
        selectedCustomer={selectedCustomer}
        onClose={handleCloseTxtViewer}
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
      <ReplaceAddMediaDialog
        open={replaceAddDialog.open}
        newFiles={replaceAddDialog.newFiles}
        existingCount={replaceAddDialog.existingCount}
        onClose={() => setReplaceAddDialog({ open: false, newFiles: null, existingCount: 0 })}
        onReplace={(files) => processFiles(files, "replace")}
        onAdd={(files) => processFiles(files, "add")}
      />

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
      <AllMentionsPopover
        anchorEl={allMentionsAnchor}
        groupMembers={groupMembers}
        onClose={() => setAllMentionsAnchor(null)}
      />
      </Box>
      {drawerOpen && selectedCustomer && (
        <CustomerDetails
          customer={(infoMember || selectedCustomer) as ConversationListEntry}
          onClose={handleCloseDrawer}
          open={drawerOpen}
          variant={isNarrowScreen ? "drawer" : "panel"}
          initialViewState={drawerViewState}
          messageInfo={selectedMessageForInfo}
          messages={messages}
          scrollToMessage={scrollToMessage}
          searchResults={searchResults}
          isSearching={isSearching}
          onSearchMessages={searchMessages}
          starFilter={starFilter}
          onSearchByDate={isNarrowScreen ? handleSearchByDateFromPanel : handleSearchByDate}
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
