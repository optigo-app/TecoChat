"use client";

import React, { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { Box, Skeleton, Typography, Menu, MenuItem, ListItemIcon, ListItemText, Divider, CircularProgress } from "@mui/material";
import { Archive, ArchiveRestore, Pin, PinOff, Star, StarOff } from "lucide-react";
import { useLoginContext } from "../../context/LoginData";
import { useConversationList } from "../../hooks/useConversationList";
import { updateConversationApi } from "../../API/SendMessage/updateConversationApi";
import { showToast } from "../../utils/toastHelper";
import { getCustomerDisplayName } from "../../utils/globalFunc";
import { ConversationItem } from "./ConversationItem";
import { CustomerListsHeader } from "./CustomerListsHeader";
import { ConversationAvatar } from "../ConversationAvatar/ConversationAvatar";
import { highlightText } from "./CustomerListFunc";
import { conversationComparator } from "./CustomerListFunc";
import AddConversation from "../AddConversation/AddConversation";
import CreateGroup from "../AddConversation/CreateGroup";
import { NotificationPermissionBar } from "../ReusableComponent/NotificationPermissionBar";
import { useFaviconBadge } from "../../hooks/useFaviconBadge";
import { useOnlineStatus } from "../../hooks/useOnlineStatus";
import ProfilePanel from "../ProfileAvatar/ProfilePanel";
import { useMobileTrigger } from "../AppLayout/AppLayout";
import type { ConversationListEntry } from "../../types/conversation";
import "./CustomerLists.scss";

interface CustomerListsProps {
  onCustomerSelect: (member: ConversationListEntry) => void;
  selectedCustomer: ConversationListEntry | null;
  isConversationRead?: boolean;
}

type TabValue = 0 | 2 | 3; // 0=All, 2=Favorite, 3=Groups

export const CustomerLists: React.FC<CustomerListsProps> = ({
  onCustomerSelect,
  selectedCustomer,
  isConversationRead = false,
}) => {
  const mobileMenuTrigger = useMobileTrigger();
  const { auth } = useLoginContext();
  const {
    chatMembers,
    loading,
    searchLoading,
    hasMore,
    currentPage,
    showEmptyState,
    serviceDown,
    serviceMessage,
    typingStates,
    drafts,
    loadMembers,
    handleSearchChange,
    setChatMembers,
    setShowEmptyState,
    searchTerm,
  } = useConversationList({ auth, selectedCustomer, isConversationRead });

  const [tabValue, setTabValue] = useState<TabValue>(0);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const [selectMember, setSelectMember] = useState<ConversationListEntry | null>(null);
  const [showNewChat, setShowNewChat] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);

  // Listen for OPEN_PROFILE_PANEL event from ProfileAvatar menu
  useEffect(() => {
    const handleOpenProfile = () => setProfileOpen(true);
    window.addEventListener("OPEN_PROFILE_PANEL", handleOpenProfile);
    return () => window.removeEventListener("OPEN_PROFILE_PANEL", handleOpenProfile);
  }, []);

  // Listen for SELECT_CONVERSATION — when only a conversationId is provided
  // (no customer object), find it in the conversation list and select it.
  // This is used by mention clicks, common groups, context menu "Message user", etc.
  useEffect(() => {
    const handleSelectConversation = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      // Only handle if no customer object is provided (page.tsx handles the
      // case where a customer object IS provided)
      if (detail?.customer) return;
      const conversationId = detail?.conversationId ?? detail?.ConversationId;
      if (!conversationId) return;
      const found = chatMembers?.data.find(
        (m: any) => Number(m.ConversationId) === Number(conversationId)
      );
      if (found) {
        onCustomerSelect(found);
      }
    };
    window.addEventListener("SELECT_CONVERSATION", handleSelectConversation as EventListener);
    return () => {
      window.removeEventListener("SELECT_CONVERSATION", handleSelectConversation as EventListener);
    };
  }, [chatMembers, onCustomerSelect]);

  const containerRef = useRef<HTMLUListElement | null>(null);
  const clickTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedConvId = selectedCustomer
    ? Number((selectedCustomer as { ConversationId?: string | number }).ConversationId ?? 0)
    : 0;

  // ── Filtered members ──────────────────────────────────────────────────────
  const filteredMembers = useMemo(() => {
    if (!chatMembers?.data) return [];
    return chatMembers.data
      .filter((member) => {
        // Search results always show
        if ((member as { isSearchResult?: boolean }).isSearchResult) return true;

        // Archive filter: in archive view show ONLY archived, otherwise hide archived
        const archiveMatch = isArchiveOpen
          ? (member as { IsArchived?: number }).IsArchived === 1
          : (member as { IsArchived?: number }).IsArchived !== 1;
        if (!archiveMatch) return false;

        // Tab filters
        const isFavoriteStatus = (member as { IsStar?: number }).IsStar === 1;
        let tabMatch = true;
        switch (tabValue) {
          case 2:
            tabMatch = isFavoriteStatus;
            break;
          case 3:
            tabMatch = (member as { IsGroup?: number }).IsGroup === 1;
            break;
          default:
            tabMatch = true;
        }
        if (!tabMatch) return false;

        // Local search filter
        const displayName = String(
          (member as { name?: string }).name ||
            getCustomerDisplayName(member as Parameters<typeof getCustomerDisplayName>[0]) ||
            ""
        ).toLowerCase();
        const email = String(
          (member as { DisplayEmail?: string }).DisplayEmail ||
            (member as { UserEmail?: string }).UserEmail ||
            (member as { email?: string }).email ||
            ""
        ).toLowerCase();
        const mobile = String(
          (member as { MobileNo?: string }).MobileNo ||
            (member as { CustomerPhone?: string }).CustomerPhone ||
            (member as { phone?: string }).phone ||
            ""
        ).toLowerCase();
        const haystack = `${displayName} ${email} ${mobile}`;
        return haystack.includes(searchTerm.toLowerCase());
      })
      .sort(conversationComparator);
  }, [chatMembers, searchTerm, tabValue, isArchiveOpen]);

  // ── Total unread conversations (for favicon badge) ────────────────────────
  const totalUnread = useMemo(() => {
    if (!chatMembers?.data) return 0;
    return chatMembers.data.reduce((acc, curr) => {
      const count = Number(
        (curr as { unreadCount?: number; UnreadCount?: number }).unreadCount ??
        (curr as { UnreadCount?: number }).UnreadCount ?? 0
      );
      return acc + (count > 0 ? 1 : 0);
    }, 0);
  }, [chatMembers?.data]);

  useFaviconBadge(totalUnread);

  // ── Online status ─────────────────────────────────────────────────────────
  const isOnline = useOnlineStatus();

  // ── Reset keyboard selection on filter/search changes ─────────────────────
  useEffect(() => {
    setSelectedIndex(-1);
  }, [searchTerm, tabValue]);

  // ── Empty state detection ─────────────────────────────────────────────────
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    if (!loading && chatMembers?.data !== null && filteredMembers.length === 0) {
      timeout = setTimeout(() => setShowEmptyState(true), 1000);
    } else {
      setShowEmptyState(false);
    }
    return () => clearTimeout(timeout);
  }, [loading, chatMembers, filteredMembers.length, setShowEmptyState]);

  // ── Click handler (debounced — short delay to prevent double-clicks) ──────
  const handleCustomerClick = useCallback(
    (member: ConversationListEntry) => {
      if (clickTimeoutRef.current) clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = setTimeout(() => onCustomerSelect(member), 50);
    },
    [onCustomerSelect]
  );

  // ── Keyboard navigation (Arrow Up/Down, Enter, Escape) ────────────────────
  const scrollToSelectedIndex = useCallback((index: number) => {
    if (!containerRef.current || index < 0) return;
    const items = containerRef.current.querySelectorAll(".member-item");
    const target = items[index] as HTMLElement | undefined;
    if (target) {
      target.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!filteredMembers.length) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => {
          const next = prev < filteredMembers.length - 1 ? prev + 1 : prev;
          scrollToSelectedIndex(next);
          return next;
        });
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => {
          const next = prev > 0 ? prev - 1 : 0;
          scrollToSelectedIndex(next);
          return next;
        });
      } else if (e.key === "Enter") {
        if (selectedIndex >= 0 && selectedIndex < filteredMembers.length) {
          e.preventDefault();
          handleCustomerClick(filteredMembers[selectedIndex]);
        }
      } else if (e.key === "Escape") {
        setSelectedIndex(-1);
      }
    },
    [filteredMembers, selectedIndex, handleCustomerClick, scrollToSelectedIndex]
  );

  // ── Infinite scroll ───────────────────────────────────────────────────────
  const handleScroll = useCallback(() => {
    if (!containerRef.current || loading || !hasMore) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    if (scrollTop + clientHeight >= scrollHeight - 80) {
      loadMembers(currentPage + 1);
    }
  }, [loading, hasMore, currentPage, loadMembers]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  // ── Archived count ────────────────────────────────────────────────────────
  const archivedCount = useMemo(
    () => chatMembers?.data?.filter((m) => (m as { IsArchived?: number }).IsArchived === 1).length || 0,
    [chatMembers?.data]
  );

  // ── Menu actions ──────────────────────────────────────────────────────────
  const handleMenuClose = () => {
    setAnchorEl(null);
    setMenuPosition(null);
    setSelectMember(null);
  };

  const handleMenuAction = async (action: string) => {
    const member = selectMember;
    handleMenuClose();
    if (!member) return;

    const convId = (member as { ConversationId?: string | number }).ConversationId;
    if (!convId) {
      showToast("Missing Conversation ID.", "error");
      return;
    }

    let isPin = (member as { IsPin?: number }).IsPin ?? 0;
    let isStar = (member as { IsStar?: number }).IsStar ?? 0;
    let isArchived = (member as { IsArchived?: number }).IsArchived ?? 0;

    if (action === "Pin") isPin = 1;
    else if (action === "UnPin") isPin = 0;
    else if (action === "Star") isStar = 1;
    else if (action === "UnStar") isStar = 0;
    else if (action === "Archive") isArchived = 1;
    else if (action === "UnArchive") isArchived = 0;

    const actionMessages: Record<string, string> = {
      Pin: "Conversation pinned 📌",
      UnPin: "Conversation unpinned",
      Star: "Conversation added to favorites ⭐",
      UnStar: "Conversation removed from favorites",
      Archive: "Conversation archived 🗂️",
      UnArchive: "Conversation unarchived",
    };

    // Optimistic update
    setChatMembers((prev) => {
      if (!prev?.data) return prev;
      const index = prev.data.findIndex(
        (m) =>
          Number((m as { ConversationId?: string | number }).ConversationId ?? 0) ===
          Number(convId)
      );
      if (index === -1) return prev;
      const updatedData = [...prev.data];
      updatedData[index] = {
        ...updatedData[index],
        IsPin: isPin,
        IsStar: isStar,
        IsArchived: isArchived,
      } as ConversationListEntry;
      updatedData.sort(conversationComparator);
      return { ...prev, data: updatedData };
    });

    // Backend sync
    try {
      const response = await updateConversationApi(auth, {
        conversationId: convId,
        isPin,
        isStar,
        isArchived,
      });
      if (response?.Status === "200" || response?.success === true) {
        showToast(actionMessages[action] || "Conversation updated", "success");
      } else {
        showToast("Failed to update conversation", "error");
        // Revert optimistic update on failure
        setChatMembers((prev) => {
          if (!prev?.data) return prev;
          const index = prev.data.findIndex(
            (m) => Number((m as { ConversationId?: string | number }).ConversationId ?? 0) === Number(convId)
          );
          if (index === -1) return prev;
          const updatedData = [...prev.data];
          updatedData[index] = {
            ...updatedData[index],
            IsPin: (member as { IsPin?: number }).IsPin ?? 0,
            IsStar: (member as { IsStar?: number }).IsStar ?? 0,
            IsArchived: (member as { IsArchived?: number }).IsArchived ?? 0,
          } as ConversationListEntry;
          updatedData.sort(conversationComparator);
          return { ...prev, data: updatedData };
        });
      }
    } catch (error) {
      console.error("Error updating conversation:", error);
      showToast("Something went wrong.", "error");
    }
  };

  const menuItems = useMemo(() => {
    if (!selectMember) return [];
    const isPin = (selectMember as { IsPin?: number }).IsPin === 1;
    const isStar = (selectMember as { IsStar?: number }).IsStar === 1;
    const isArchived = (selectMember as { IsArchived?: number }).IsArchived === 1;
    return [
      {
        action: isPin ? "UnPin" : "Pin",
        icon: isPin ? <PinOff size={18} /> : <Pin size={18} />,
        label: isPin ? "Unpin" : "Pin",
      },
      {
        action: isStar ? "UnStar" : "Star",
        icon: isStar ? <StarOff size={18} /> : <Star size={18} />,
        label: isStar ? "Unfavorite" : "Favorite",
      },
      {
        action: isArchived ? "UnArchive" : "Archive",
        icon: isArchived ? <ArchiveRestore size={18} /> : <Archive size={18} />,
        label: isArchived ? "Unarchive" : "Archive",
      },
    ];
  }, [selectMember]);

  // ── Tab config ────────────────────────────────────────────────────────────
  const tabs: { label: string; value: TabValue }[] = [
    { label: "All", value: 0 },
    { label: "Groups", value: 3 },
    { label: "Favorite", value: 2 },
  ];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="customer_lists_mainDiv">
      {!isOnline && <Box className="offline-sidebar-overlay" />}
      {profileOpen && <ProfilePanel onBack={() => setProfileOpen(false)} />}
      <CustomerListsHeader
        isArchiveOpen={isArchiveOpen}
        searchTerm={searchTerm}
        searchLoading={searchLoading}
        handleSearchChange={handleSearchChange}
        handleKeyDown={handleKeyDown}
        onBack={() => setIsArchiveOpen(false)}
        onNewChat={() => setShowNewChat(true)}
        onCreateGroup={() => setShowCreateGroup(true)}
        mobileMenuTrigger={mobileMenuTrigger}
      />

      {/* Tab filters — hidden in archive view */}
      {!isArchiveOpen && (
        <div className="customer_lists_filters">
          {tabs.map((tab) => (
            <button
              key={tab.value}
              className={`filter-tab ${tabValue === tab.value ? "active" : ""}`}
              onClick={() => setTabValue(tab.value)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Notification permission banner */}
      <NotificationPermissionBar />

      {/* List */}
      <div className="customer_lists_main">
        {serviceDown && serviceMessage && (
          <Box sx={{ p: 3, textAlign: "center" }}>
            <Typography color="error" variant="body2">
              {serviceMessage}
            </Typography>
          </Box>
        )}

        <ul ref={containerRef} className="app-scroll">
          {/* Archived row — only in normal view, hidden in archive view and favorite tab */}
          {archivedCount > 0 && !searchTerm && !isArchiveOpen && tabValue !== 2 && (
            <li className="member-item archived-row" onClick={() => setIsArchiveOpen(true)}>
              <div className="member-item">
                <div className="member-avatar">
                  <div className="archived-icon-wrapper">
                    <Archive size={20} />
                  </div>
                </div>
                <div className="member-info">
                  <div className="member-header">
                    <Typography className="member-name">Archived</Typography>
                    <Typography className="archived-count">{archivedCount}</Typography>
                  </div>
                </div>
              </div>
            </li>
          )}

          {/* Loading skeletons — stay visible until data is actually bound in the UI */}
          {(loading || !chatMembers?.data?.length) && !showEmptyState && !serviceDown && (
            <>
              {[...Array(12)].map((_, i) => (
                <li key={`skeleton-${i}`} className="member-item" style={{ pointerEvents: "none" }}>
                  <div className="member-item">
                    <div className="member-avatar">
                      <Skeleton variant="circular" width={40} height={40} />
                    </div>
                    <div className="member-info" style={{ flexGrow: 1 }}>
                      <div className="member-header">
                        <Skeleton variant="text" width="60%" height={20} />
                        <Skeleton variant="text" width={40} height={14} />
                      </div>
                      <div className="member-message">
                        <Skeleton variant="text" width="80%" height={16} />
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </>
          )}

          {/* Searching... indicator */}
          {searchLoading && (chatMembers?.data?.length ?? 0) > 0 && (
            <li style={{ textAlign: "center", padding: "6px 0", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
              <Typography variant="caption" color="textSecondary" sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 1, fontSize: "12px" }}>
                <CircularProgress size={12} thickness={5} /> Searching...
              </Typography>
            </li>
          )}

          {/* Conversation items (exclude search results) */}
          {filteredMembers
            .filter((member) => !(member as { isSearchResult?: boolean }).isSearchResult)
            .map((member, index) => {
            const convId = Number(
              (member as { ConversationId?: string | number }).ConversationId ?? 0
            );
            const isSelected = convId === selectedConvId && convId !== 0;
            const isSelectedAndReading = isSelected && isConversationRead;
            const isMenuOpen =
              (Boolean(anchorEl) || Boolean(menuPosition)) &&
              Number(
                (selectMember as { ConversationId?: string | number })?.ConversationId ?? 0
              ) === convId;
            const unreadCount = Number((member as { unreadCount?: number }).unreadCount ?? 0);
            // Old code: show badge when unread > 0 AND NOT (selected AND read)
            const shouldShowUnreadBadge = unreadCount > 0 && !(isSelected && isConversationRead);

            return (
              <ConversationItem
                key={
                  (member as { ConversationId?: string | number }).ConversationId ??
                  (member as { Id?: string | number }).Id ??
                  `item-${convId}`
                }
                member={member}
                isSelected={isSelected}
                isSelectedAndReading={isSelectedAndReading}
                isKeyboardSelected={index === selectedIndex}
                isMenuOpen={isMenuOpen}
                shouldShowUnreadBadge={shouldShowUnreadBadge}
                typingState={typingStates[convId]}
                draftText={drafts[convId]}
                searchTerm={searchTerm}
                handleCustomerClick={handleCustomerClick}
                setAnchorEl={setAnchorEl}
                setSelectMember={setSelectMember}
                setMenuPosition={setMenuPosition}
              />
            );
          })}

          {/* Search results (separate section, like old app) */}
          {searchTerm && filteredMembers.some((m) => (m as { isSearchResult?: boolean }).isSearchResult) && (
            <div className="search-results-group">
              {filteredMembers
                .filter((member) => (member as { isSearchResult?: boolean }).isSearchResult)
                .map((member, srIndex) => {
                  const sr = member as { Id?: string | number; name?: string; email?: string; UserEmail?: string; DisplayEmail?: string };
                  const srId = sr.Id ?? `search-${Math.random()}`;
                  const srName = sr.name || "Unknown";
                  const srEmail = sr.email || sr.UserEmail || sr.DisplayEmail || "";
                  const conversationCount = filteredMembers.filter((m) => !(m as { isSearchResult?: boolean }).isSearchResult).length;
                  const isKeyboardSelected = srIndex + conversationCount === selectedIndex;
                  return (
                    <li
                      key={`search-${srId}`}
                      className={`member-item search-result ${isKeyboardSelected ? "keyboard-selected" : ""}`}
                      onClick={() => handleCustomerClick(member)}
                    >
                      <div className="member-avatar">
                        <ConversationAvatar member={member} />
                      </div>
                      <div className="member-info">
                        <div className="member-name" style={{ fontWeight: 500, fontSize: "15px" }}>
                          {highlightText(srName, searchTerm)}
                        </div>
                        {srEmail && (
                          <div className="member-email" style={{ fontSize: "13px", color: "text.secondary", marginTop: "2px" }}>
                            {highlightText(srEmail, searchTerm)}
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
            </div>
          )}

          {/* Loading more indicator */}
          {loading && (chatMembers?.data?.length ?? 0) > 0 && (
            <li style={{ textAlign: "center", padding: "12px" }}>
              <Skeleton variant="text" width={120} height={20} sx={{ margin: "0 auto" }} />
            </li>
          )}

          {/* Empty state */}
          {showEmptyState && !loading && filteredMembers.length === 0 && (
            <li className="empty-state">
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center", py: 4 }}>
                No conversations found.
              </Typography>
            </li>
          )}
        </ul>
      </div>

      {/* Context menu */}
      <Menu
        anchorEl={menuPosition ? null : anchorEl}
        open={Boolean(anchorEl) || Boolean(menuPosition)}
        onClose={handleMenuClose}
        anchorReference={menuPosition ? "anchorPosition" : "anchorEl"}
        anchorPosition={menuPosition ? { top: menuPosition.top, left: menuPosition.left } : undefined}
        slotProps={{
          paper: {
            sx: {
              borderRadius: "16px",
              minWidth: "200px",
              boxShadow: "0 12px 40px rgba(0, 0, 0, 0.15)",
              bgcolor: "background.paper",
              border: "1px solid",
              borderColor: "divider",
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
        {menuItems.map((item) => (
          <MenuItem
            key={item.action}
            onClick={() => handleMenuAction(item.action)}
          >
            <ListItemIcon>
              {item.icon}
            </ListItemIcon>
            <ListItemText primary={item.label} />
          </MenuItem>
        ))}
      </Menu>

      {/* New chat / create group overlays */}
      {showNewChat && (
        <Box className="new-chat-overlay">
          <AddConversation
            onBack={() => setShowNewChat(false)}
            onClose={() => setShowNewChat(false)}
            onCustomerSelect={(customer) => {
              onCustomerSelect(customer as ConversationListEntry);
              setShowNewChat(false);
            }}
          />
        </Box>
      )}
      {showCreateGroup && (
        <Box className="new-chat-overlay">
          <CreateGroup
            onBack={() => setShowCreateGroup(false)}
            onClose={() => setShowCreateGroup(false)}
            onContinue={(result) => {
              setShowCreateGroup(false);
              const rd =
                result?.response?.Data?.rd?.[0] || result?.response?.rd?.[0];
              const newConvId =
                rd?.ConversationId || result?.response?.Data?.rd?.ConversationId;
              if (newConvId) {
                const now = new Date().toISOString();
                const newGroupCustomer = {
                  ConversationId: newConvId,
                  ConversationName: result.name || "New Group",
                  name: result.name || "New Group",
                  IsGroup: 1,
                  LastMessage: "Group created",
                  LastMessageType: 1,
                  LastMessageDate: now,
                  LastUpdatedDate: now,
                  DateTime: now,
                  UnreadCount: 0,
                  unreadCount: 0,
                  IsAdmin: 1,
                  GroupMembers: result.members || [],
                  isStatusChange: false,
                };
                window.dispatchEvent(
                  new CustomEvent("UPDATE_CONVERSATION_ITEM", {
                    detail: newGroupCustomer,
                  })
                );
                window.dispatchEvent(
                  new CustomEvent("SELECT_NEW_CONVERSATION", {
                    detail: { customer: newGroupCustomer },
                  })
                );
              }
            }}
          />
        </Box>
      )}
    </div>
  );
};
