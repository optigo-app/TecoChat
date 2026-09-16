"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { fetchConversationLists, preLoadConversations } from "../API/ConverLists/ConversationLists";
import { muteConversationApi } from "../API/ConversationMute/MuteConversationApi";
import {
  processApiResponse,
  mapSearchResults,
  conversationComparator,
  getMessagePreview,
  normalizeMessageType,
  mapMessageTypeToCode,
  resolveConversationName,
  getMemberTimeValue,
} from "../components/CustomerLists/CustomerListFunc";
import { formatDateTime } from "../utils/dateUtils";
import {
  getCustomerAvatarSeed,
  getCustomerDisplayName,
  getWhatsAppAvatarConfig,
} from "../utils/globalFunc";
import {
  addInternalMessageHandler,
  addInternalStatusHandler,
  addMessageReactionHandler,
  addInternalMessageDeletionHandler,
  addGroupEventHandler,
  addGroupMemberHandler,
  addGroupPermissionHandler,
  addInternalTypingHandler,
} from "../socket";
import { notify } from "../utils/notificationTemplates";
import { isConversationMuted, checkIfUserMentioned } from "../utils/mentionUtils";
import type {
  ConversationListData,
  ConversationListEntry,
  TypingState,
} from "../types/conversation";
import type { AuthData } from "../contexts/LoginData";
import { getConversations, putConversations, upsertConversation } from "../db/conversationCache";
import { putMessages } from "../db/messageCache";
import { normalizeServerMessages } from "../utils/messageUtils";
import { getAllDrafts } from "../db/draftCache";

interface UseConversationListOptions {
  auth: AuthData | null;
  pageSize?: number;
  selectedCustomer?: ConversationListEntry | null;
  isConversationRead?: boolean;
}

interface UseConversationListReturn {
  chatMembers: ConversationListData | null;
  loading: boolean;
  preloading: boolean;
  searchLoading: boolean;
  hasMore: boolean;
  currentPage: number;
  typingStates: Record<number, TypingState>;
  drafts: Record<number, string>;
  showEmptyState: boolean;
  serviceDown: boolean;
  serviceMessage?: string;
  loadMembers: (page?: number, reset?: boolean, search?: string | null) => Promise<void>;
  handleSearchChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  clearSearch: () => void;
  setChatMembers: React.Dispatch<React.SetStateAction<ConversationListData | null>>;
  setShowEmptyState: React.Dispatch<React.SetStateAction<boolean>>;
  searchTerm: string;
}

export const useConversationList = ({
  auth,
  pageSize = 100,
  selectedCustomer = null,
  isConversationRead = false,
}: UseConversationListOptions): UseConversationListReturn => {
  const [chatMembers, setChatMembers] = useState<ConversationListData | null>(null);
  const [loading, setLoading] = useState(false);
  const [preloading, setPreloading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [showEmptyState, setShowEmptyState] = useState(false);
  const [serviceDown, setServiceDown] = useState(false);
  const [serviceMessage, setServiceMessage] = useState<string | undefined>(undefined);
  const [typingStates, setTypingStates] = useState<Record<number, TypingState>>({});
  const [drafts, setDrafts] = useState<Record<number, string>>({});

  const fetchControllerRef = useRef<AbortController | null>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchTermRef = useRef("");
  const selectedConversationIdRef = useRef<string | number | undefined>(undefined);
  const isConversationReadingRef = useRef(false);
  const typingTimeoutsRef = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  // Track pending setTimeout IDs from socket handlers so they can be cleared on unmount
  const socketTimerIdsRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  // Keep refs in sync
  useEffect(() => {
    searchTermRef.current = searchTerm;
  }, [searchTerm]);

  useEffect(() => {
    selectedConversationIdRef.current = selectedCustomer?.ConversationId ?? undefined;
    isConversationReadingRef.current = Boolean(isConversationRead);

    // Clear unread count when conversation is selected and being read
    if (selectedCustomer?.ConversationId && isConversationRead) {
      setChatMembers((prev) => {
        if (!prev?.data) return prev;
        const updatedData = prev.data.map((member) => {
          if (Number(member.ConversationId) === Number(selectedCustomer.ConversationId)) {
            return { ...member, unreadCount: 0, UnreadCount: 0 } as ConversationListEntry;
          }
          return member;
        });
        return { data: updatedData, total: prev.total };
      });
    }
  }, [selectedCustomer, isConversationRead]);

  // ── Load members ──────────────────────────────────────────────────────────
  const loadMembers = useCallback(
    async (page = 1, reset = false, search: string | null = null) => {
      if (loading || (!reset && !hasMore)) return;
      if (!auth?.token || !auth?.userId) return;

      // Cancel previous request
      if (fetchControllerRef.current) {
        fetchControllerRef.current.abort();
      }
      const controller = new AbortController();
      fetchControllerRef.current = controller;

      if (reset) setShowEmptyState(false);

      const searchToUse = search !== null ? search : searchTermRef.current;
      const isSearchRequest = Boolean(searchToUse) && reset;
      if (isSearchRequest) setSearchLoading(true);

      let didShowCache = false;
      if (reset && !isSearchRequest) {
        try {
          const cached = await getConversations(auth);
          if (cached.length > 0) {
            setChatMembers({ data: cached, total: cached.length });
            didShowCache = true;
          }
        } catch {
          /* ignore cache read errors */
        }
      }

      if (!didShowCache && !isSearchRequest) setLoading(true);

      try {
        const response = await fetchConversationLists(
          page,
          pageSize,
          auth,
          searchToUse,
          controller.signal
        );

        if (response.serviceDown) {
          setServiceDown(true);
          setServiceMessage(response.serviceMessage);
          setChatMembers((prev) => prev ?? { data: [], total: 0 });
          setHasMore(false);
          window.dispatchEvent(
            new CustomEvent("SERVICE_DOWN", {
              detail: {
                message:
                  response.serviceMessage || "Service is temporarily unavailable.",
              },
            })
          );
          return;
        }
        setServiceDown(false);
        setServiceMessage(undefined);
        window.dispatchEvent(new CustomEvent("SERVICE_UP"));

        const currentConversations = processApiResponse(response.data?.rd || []);
        const searchResults = mapSearchResults(response.data?.rd1);

        const mergedConversations: ConversationListEntry[] = searchToUse
          ? [
              ...searchResults
                .filter(
                  (sr) =>
                    !currentConversations.some(
                      (cc) =>
                        (sr.ReceiverId &&
                          cc.ReceiverId &&
                          Number(cc.ReceiverId) === Number(sr.ReceiverId)) ||
                        (sr.Id &&
                          cc.CustomerId &&
                          Number(cc.CustomerId) === Number(sr.Id))
                    )
                )
                .sort((a, b) =>
                  String((a as { name?: string }).name || "").localeCompare(
                    String((b as { name?: string }).name || "")
                  )
                ),
              ...currentConversations,
            ]
          : currentConversations;

        const sortedConversations = mergedConversations.sort(conversationComparator);

        setChatMembers((prev) => {
          let finalData = sortedConversations;
          if (reset && prev?.data) {
            const missing = prev.data.filter(
              (old) =>
                !sortedConversations.some(
                  (n) =>
                    Number((n as { ConversationId?: string | number }).ConversationId ?? 0) ===
                    Number((old as { ConversationId?: string | number }).ConversationId ?? 0)
                )
            );
            if (missing.length) {
              finalData = [...sortedConversations, ...missing];
              finalData.sort(conversationComparator);
            }
          }
          return {
            data: finalData,
            total: Math.max(response.total, finalData.length),
          };
        });

        const moreAvailable = response?.hasMore ?? sortedConversations.length > 0;
        setHasMore(moreAvailable);
        if (moreAvailable) setCurrentPage(page);

        // Persist the fresh conversation list to IndexedDB (best-effort).
        if (!isSearchRequest && sortedConversations.length > 0) {
          putConversations(auth, sortedConversations).catch(() => {
            /* ignore */
          });
        }
      } catch (error) {
        if (error instanceof Error && error.message === "AbortError") return;
        console.error("Error loading members:", error);
      } finally {
        if (fetchControllerRef.current === controller) {
          if (isSearchRequest) setSearchLoading(false);
          else setLoading(false);
        }
      }
    },
    [loading, hasMore, auth, pageSize]
  );

  // ── Search handler (debounced 500ms) ──────────────────────────────────────
  const debouncedSearch = useCallback(
    (value: string) => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
      searchTimeoutRef.current = setTimeout(() => loadMembers(1, true, value), 500);
    },
    [loadMembers]
  );

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const value = e.target.value;
      setSearchTerm(value);
      if (value === "") {
        if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
        setSearchLoading(false);
        loadMembers(1, true, "");
      } else {
        setSearchLoading(true);
        debouncedSearch(value);
      }
    },
    [debouncedSearch, loadMembers]
  );

  // Clear the search term and reload the default list. Used when the user
  // taps a search result on mobile so the search panel closes.
  const clearSearch = useCallback(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    setSearchTerm("");
    setSearchLoading(false);
    loadMembers(1, true, "");
  }, [loadMembers]);

  // ── handleSocketUpdate: the core real-time update function ────────────────
  const handleSocketUpdate = useCallback(
    (incoming: Record<string, unknown>, isStatusChange = false) => {
      let pendingNotify: Record<string, unknown> | null = null;

      setChatMembers((prev) => {
        if (!prev?.data) return prev;

        const conversationId = (incoming.ConversationId as string | number) ?? (incoming.conversationId as string | number);
        if (conversationId == null) return prev;

        const resolvedName = resolveConversationName(incoming, (c) => getCustomerDisplayName(c as Parameters<typeof getCustomerDisplayName>[0]));
        const myId = Number(auth?.id ?? auth?.userId);
        const senderId = Number((incoming.SenderId as string | number) ?? (incoming.Sender as string | number));
        const isOutgoing = myId && senderId && myId === senderId;
        const senderName = String(incoming.SenderName ?? incoming.FirstName ?? incoming.UserName ?? "").trim();
        const outgoingName = isOutgoing
          ? String(
              (incoming.ConversationName as string) ||
              (incoming.MemberName as string) ||
              (incoming.name as string) ||
              ((incoming.RecieverName as string) &&
                String(incoming.RecieverName).trim() !== senderName &&
                String(incoming.RecieverName).trim() !== String(auth?.username ?? "")
                  ? (incoming.RecieverName as string) : "") ||
              (incoming.CustomerName as string) ||
              ""
            ).trim()
          : "";
        const effectiveName = isOutgoing ? (outgoingName || resolvedName) : resolvedName;
        const updatedData = [...prev.data];
        const index = updatedData.findIndex(
          (member) => Number(member.ConversationId) === Number(conversationId)
        );

        const existingChat = index !== -1 ? (updatedData[index] as Record<string, unknown>) : null;
        const normalizedType = normalizeMessageType(
          (incoming.MessageType as string | number) ??
            (incoming.LastMessageType as string | number) ??
            (existingChat?.LastMessageType as string | number)
        );

        const previewMsg = {
          Message: (incoming.IsDeletedForEveryone === 1 && isOutgoing)
            ? (incoming.Message1 as string || incoming.Message as string)
            : ((incoming.Message as string) ?? (existingChat?.LastMessage as string) ?? ""),
          MessageType: normalizedType,
          SystemMsg: (incoming.SystemMsg as number) ?? (incoming.LastMessageSystemMsg as number) ?? (existingChat?.SystemMsg as number),
          IsDeletedForEveryone: incoming.IsDeletedForEveryone as number,
        };
        const messagePreview = getMessagePreview(previewMsg);
        const messagePreviewText = messagePreview.text;
        const messagePreviewNode = messagePreview.node;
        const dateTime = (incoming.DateTime as string) || (incoming.LastMessageDate as string) || (incoming.LastUpdatedDate as string);
        const formattedTime = formatDateTime(dateTime, "chatTimestamp");

        const normalizedDirection = isOutgoing ? 1 : 0;

        const isOpenConversation =
          Number(selectedConversationIdRef.current) === Number(conversationId) &&
          Boolean(isConversationReadingRef.current);

        const isWindowFocused = typeof document !== "undefined" && document.hasFocus();

        const muted = isConversationMuted(
          (existingChat as any)?.IsMuted,
          (existingChat as any)?.MuteExpiresAt
        );
        const mentioned = checkIfUserMentioned(
          (incoming as any)?.MentionUsers,
          auth?.id
        );

        const shouldNotify = !isOutgoing && !isStatusChange && (!isOpenConversation || !isWindowFocused)
          && (!muted || mentioned);

        if (shouldNotify) {
          pendingNotify = {
            senderName: resolvedName,
            message: messagePreviewText,
            conversationId,
            conversationName: (existingChat?.name as string) || (incoming.ConversationName as string),
            isGroup: (existingChat?.IsGroup as number) ?? (incoming.IsGroup as number),
            tag: `msg-${conversationId}`,
            isOpenConversation,
            ...incoming,
          };
        }

        const nextUnreadCount = (currentCount: number) => {
          if (isStatusChange || isOutgoing) return currentCount;
          if (isOpenConversation) return 0;
          return (currentCount || 0) + 1;
        };

        const nextUnreadOnStatus = (currentCount: number) => {
          if (!isStatusChange) return currentCount;
          const raw = incoming.MessageStatus ?? incoming.Status;
          if (Number(raw) === 1) return 0;
          return currentCount;
        };

        if (index !== -1) {
          const currentChat = updatedData[index] as Record<string, unknown>;
          const currentUnread = Number(currentChat.unreadCount ?? currentChat.UnreadCount ?? 0);

          const incomingId = (incoming.MessageId as string | number) ?? (incoming.Id as string | number);
          const isSameMessage = incomingId
            ? String(incomingId) === String(currentChat.LastMessageId)
            : (currentChat.lastMessageText === messagePreviewText &&
               currentChat.lastMessageTime === formattedTime);

          if (isStatusChange && !incomingId && !incoming.Message) {
            const unreadFinal = nextUnreadOnStatus(currentUnread);
            (currentChat as Record<string, unknown>).unreadCount = unreadFinal;
            (currentChat as Record<string, unknown>).UnreadCount = unreadFinal;
            (currentChat as Record<string, unknown>).LastMessageStatus =
              incoming.MessageStatus ?? incoming.Status ?? incoming.status ?? currentChat.LastMessageStatus;
            updatedData.sort(conversationComparator);
            return { ...prev, data: updatedData };
          }

          if (isSameMessage && !isStatusChange) return prev;

          const unreadAfterMsg = nextUnreadCount(currentUnread);
          const unreadFinal = nextUnreadOnStatus(unreadAfterMsg);

          const merged = { ...currentChat } as Record<string, unknown>;
          merged.name = (String(currentChat.name ?? "").trim() && String(currentChat.name).trim() !== "Unknown")
            ? currentChat.name
            : resolvedName;
          merged.lastMessage = messagePreviewNode;
          merged.lastMessageText = messagePreviewText;
          merged.lastMessageTime = formattedTime;
          merged.lastMessageTimeValue = isStatusChange
            ? currentChat.lastMessageTimeValue
            : (() => {
                const now = new Date();
                const offset = now.getTimezoneOffset() * 60000;
                return new Date(now.getTime() - offset).toISOString();
              })();
          merged.unreadCount = unreadFinal;
          merged.UnreadCount = unreadFinal;
          merged.LastMessage = incoming.Message ?? currentChat.LastMessage;
          merged.LastMessageType = mapMessageTypeToCode(normalizedType);
          merged.LastMessageStatus = incoming.MessageStatus ?? incoming.Status ?? incoming.status ?? currentChat.LastMessageStatus;
          merged.LastMessageDirection = normalizedDirection;
          merged.LastMessageId = incomingId || currentChat.LastMessageId;
          merged.LastMessageDate = dateTime || currentChat.LastMessageDate;
          merged.LastUpdatedDate = dateTime || currentChat.LastUpdatedDate;
          merged.SystemMsg = incoming.SystemMsg ?? incoming.LastMessageSystemMsg ?? currentChat.SystemMsg;
          merged.IsDeletedForEveryone = incoming.IsDeletedForEveryone ?? currentChat.IsDeletedForEveryone;

          updatedData[index] = merged as ConversationListEntry;
        } else {
          // New conversation not in list yet
          const unread = isStatusChange || isOutgoing ? 0 : (isOpenConversation ? 0 : 1);
          const avatarSeed = (isOutgoing ? outgoingName : "") || getCustomerAvatarSeed(incoming) || effectiveName;
          const receiverId = (incoming.ReceiverId as string | number) || (incoming.Receiver as string | number) || (incoming.CustomerId as string | number);

          const newCustomer = {
            ConversationId: conversationId,
            name: effectiveName,
            ConversationName: effectiveName,
            lastMessage: messagePreviewNode,
            lastMessageText: messagePreviewText,
            lastMessageTime: formattedTime,
            lastMessageTimeValue: dateTime,
            unreadCount: unread,
            UnreadCount: unread,
            LastMessage: (incoming.Message as string) ?? "",
            LastMessageType: mapMessageTypeToCode(normalizedType),
            LastMessageStatus: (incoming.MessageStatus as string | number) ?? (incoming.Status as string | number) ?? (incoming.status as string | number),
            LastMessageDirection: normalizedDirection,
            LastMessageId: (incoming.MessageId as string | number) ?? (incoming.Id as string | number),
            LastMessageDate: dateTime,
            LastUpdatedDate: dateTime,
            DateTime: dateTime,
            IsGroup: (incoming.IsGroup as number) !== undefined ? incoming.IsGroup as number : 0,
            GroupMembers: (incoming.GroupMembers as unknown[]) || [],
            IsStar: (incoming.IsStar as number) ?? 0,
            IsPin: (incoming.IsPin as number) ?? 0,
            IsDeletedForEveryone: (incoming.IsDeletedForEveryone as number) ?? 0,
            ProfileImageUrl: (incoming.ProfileImageUrl as string) || (incoming.ProfileImage as string) || "",
            ReceiverId: isOutgoing
              ? ((incoming.ReceiverId as string | number) || (incoming.UserId as string | number) || (incoming.CustomerId as string | number))
              : ((incoming.SenderId as string | number) || (incoming.Sender as string | number) || (incoming.UserId as string | number)),
            avatar: null,
            avatarConfig: getWhatsAppAvatarConfig(avatarSeed),
          } as ConversationListEntry;
          updatedData.push(newCustomer);
        }

        if (index !== -1 && updatedData.length > 1) {
          const [moved] = updatedData.splice(index, 1);
          const movedPinned = Number((moved as any).IsPin || 0) === 1;
          const movedTime = getMemberTimeValue(moved);
          let lo = 0, hi = updatedData.length;
          while (lo < hi) {
            const mid = (lo + hi) >> 1;
            const midPinned = Number((updatedData[mid] as any).IsPin || 0) === 1;
            const midTime = getMemberTimeValue(updatedData[mid]);
            if (midPinned !== movedPinned) {
              if (midPinned) lo = mid + 1;
              else hi = mid;
            } else if (midTime > movedTime) {
              lo = mid + 1;
            } else {
              hi = mid;
            }
          }
          updatedData.splice(lo, 0, moved);
        } else {
          updatedData.sort(conversationComparator);
        }
        // Write-through: persist the updated conversation to IndexedDB.
        const updatedEntry = updatedData.find(
          (m) => Number((m as any).ConversationId) === Number(conversationId)
        );
        if (updatedEntry) {
          upsertConversation(auth, updatedEntry).catch(() => {
            /* ignore */
          });
        }
        return { ...prev, data: updatedData };
      });

      if (pendingNotify) {
        notify(pendingNotify, "NEW_MESSAGE", auth);
      }
    },
    [auth]
  );

  useEffect(() => {
    if (!auth?.token || !auth?.userId) return;

    const scheduleSocketUpdate = (data: Record<string, unknown>, isStatusChange: boolean) => {
      const id = setTimeout(() => {
        socketTimerIdsRef.current.delete(id);
        handleSocketUpdate(data, isStatusChange);
      }, 0);
      socketTimerIdsRef.current.add(id);
    };

    const r1 = addInternalMessageHandler((data) => scheduleSocketUpdate(data, false));
    const r2 = addInternalStatusHandler((data) => scheduleSocketUpdate(data, true));
    const r3 = addMessageReactionHandler((data) => scheduleSocketUpdate(data, true));
    const r4 = addInternalMessageDeletionHandler((data) => scheduleSocketUpdate(data, true));

    return () => {
      r1(); r2(); r3(); r4();
      // Clear any pending deferred timers so they don't fire after unmount
      socketTimerIdsRef.current.forEach((id) => clearTimeout(id));
      socketTimerIdsRef.current.clear();
    };
  }, [auth?.token, auth?.userId, handleSocketUpdate]);

  // ── Typing indicator handler ──────────────────────────────────────────────
  useEffect(() => {
    if (!auth?.token || !auth?.userId) return;
    const currentUserId = Number(auth?.id || auth?.userId);
    const deferredTimers = new Set<ReturnType<typeof setTimeout>>();

    const cleanup = addInternalTypingHandler((data: Record<string, unknown>) => {
      // Defer to setTimeout so the socket 'message' handler returns quickly
      const deferId = setTimeout(() => {
        deferredTimers.delete(deferId);
        const conversationId = Number(data.ConversationId);
        const senderId = Number(data.SenderId);
        if (senderId === currentUserId) return;

        if (data.isTyping === false) {
          setTypingStates((prev) => {
            const newState = { ...prev };
            delete newState[conversationId];
            return newState;
          });
          if (typingTimeoutsRef.current[conversationId]) {
            clearTimeout(typingTimeoutsRef.current[conversationId]);
            delete typingTimeoutsRef.current[conversationId];
          }
        } else {
          console.log("[TYPING] Received typing event:", {
            conversationId,
            senderId,
            UserName: data.UserName,
            ProfileImageUrl: data.ProfileImageUrl,
            ProfileImage: data.ProfileImage,
            isTyping: data.isTyping,
            allKeys: Object.keys(data),
          });
          setTypingStates((prev) => ({
            ...prev,
            [conversationId]: {
              isTyping: true,
              userName: data.UserName as string,
              profileImage: (data.ProfileImageUrl as string) || (data.ProfileImage as string),
            },
          }));
          if (typingTimeoutsRef.current[conversationId]) clearTimeout(typingTimeoutsRef.current[conversationId]);
        typingTimeoutsRef.current[conversationId] = setTimeout(() => {
          setTypingStates((prev) => {
            const newState = { ...prev };
            delete newState[conversationId];
            return newState;
          });
          delete typingTimeoutsRef.current[conversationId];
        }, 5000);
        }
      }, 0);
      deferredTimers.add(deferId);
    });

    return () => {
      cleanup();
      deferredTimers.forEach((id) => clearTimeout(id));
      deferredTimers.clear();
      Object.values(typingTimeoutsRef.current).forEach(clearTimeout);
      typingTimeoutsRef.current = {};
    };
  }, [auth?.token, auth?.userId, auth?.id]);

  // ── Group event handler ───────────────────────────────────────────────────
  useEffect(() => {
    if (!auth?.token || !auth?.userId) return;
    const currentUserId = Number(auth?.id || auth?.userId);

    const handleGroupEvent = (data: Record<string, unknown>) => {
      if (!data || !data.conversationId) return;
      const eventNotificationMap: Record<string, string> = {  
        group_created: "GROUP_CREATED",
        group_updated: "GROUP_UPDATED",
      };
      const notificationTemplate = eventNotificationMap[data.eventType as string];
      if (notificationTemplate && String(selectedCustomer?.ConversationId) !== String(data.conversationId)) {
        notify(data, notificationTemplate, auth);
      }
      if (data.conversationData) {
        const normalized = processApiResponse([data.conversationData as never])[0];
        if (normalized) {
          setChatMembers((prev) => {
            const prevData = Array.isArray(prev?.data) ? prev.data : [];
            const updatedData = [...prevData];
            const idx = updatedData.findIndex(
              (c) => Number(c.ConversationId) === Number(data.conversationId)
            );
            if (idx !== -1) {
              const existing = updatedData[idx] as Record<string, unknown>;
              const merged = { ...existing, ...normalized } as Record<string, unknown>;
              if (!normalized.ConversationName || normalized.name === "Unknown") {
                merged.name = existing.name;
                merged.ConversationName = existing.ConversationName;
              }
              if (!normalized.GroupDesc) merged.GroupDesc = existing.GroupDesc;
              updatedData[idx] = merged as ConversationListEntry;
            } else if (data.eventType === "group_created") {
              updatedData.push(normalized as ConversationListEntry);
              updatedData.sort(conversationComparator);
              return { data: updatedData, total: (prev?.total ?? 0) + 1 };
            }
            updatedData.sort(conversationComparator);
            return { data: updatedData, total: prev?.total ?? updatedData.length };
          });
        }
      }
    };

    const handleMemberEvent = (data: Record<string, unknown>) => {
      if (!data || !data.conversationId) return;
      const isCurrentUserRemoved =
        data.eventType === "member_removed" &&
        Number(data.removedMemberId) === currentUserId;
      const eventNotificationMap: Record<string, string> = {
        member_added: "MEMBER_ADDED",
        member_removed: isCurrentUserRemoved ? "YOU_WERE_REMOVED" : "MEMBER_REMOVED",
        member_promoted: "MEMBER_PROMOTED",
        member_demoted: "MEMBER_DEMOTED",
      };
      const notificationTemplate = eventNotificationMap[data.eventType as string];
      if (notificationTemplate && String(selectedCustomer?.ConversationId) !== String(data.conversationId)) {
        notify(data, notificationTemplate, auth);
      }
      if (data.conversationData) {
        const normalized = processApiResponse([data.conversationData as never])[0];
        if (normalized) {
          setChatMembers((prev) => {
            const prevData = Array.isArray(prev?.data) ? prev.data : [];
            const updatedData = [...prevData];
            const idx = updatedData.findIndex(
              (c) => Number(c.ConversationId) === Number(data.conversationId)
            );
            if (idx !== -1) {
              const existing = updatedData[idx] as Record<string, unknown>;
              const merged = { ...existing, ...normalized } as Record<string, unknown>;
              if (!normalized.ConversationName || normalized.name === "Unknown") {
                merged.name = existing.name;
                merged.ConversationName = existing.ConversationName;
              }
              if (!normalized.GroupDesc) merged.GroupDesc = existing.GroupDesc;
              updatedData[idx] = merged as ConversationListEntry;
            } else if (data.eventType === "member_added") {
              updatedData.push(normalized as ConversationListEntry);
            }
            updatedData.sort(conversationComparator);
            return { data: updatedData, total: prev?.total ?? updatedData.length };
          });
        }
      } else {
        loadMembers(1, true, searchTerm);
      }
    };

    const handlePermissionEvent = (data: Record<string, unknown>) => {
      if (!data || !data.conversationId) return;
      if (String(selectedCustomer?.ConversationId) !== String(data.conversationId)) {
        notify(data, "PERMISSION_CHANGED", auth);
      }
    };

    const r1 = addGroupEventHandler(handleGroupEvent);
    const r2 = addGroupMemberHandler(handleMemberEvent);
    const r3 = addGroupPermissionHandler(handlePermissionEvent);

    return () => {
      r1(); r2(); r3();
    };
  }, [auth?.token, auth?.userId, auth?.id, selectedCustomer?.ConversationId, searchTerm, loadMembers]);

  useEffect(() => {
    if (!auth?.token || !auth?.userId) return;

    let cancelled = false;

    (async () => {
      // 1. Check if cache exists
      let cached: ConversationListEntry[] = [];
      try {
        cached = await getConversations(auth);
        console.log("[RELOAD] Cache read:", cached.length, "conversations found");
      } catch (err) {
        console.error("[RELOAD] Cache read error:", err);
      }

      if (cancelled) return;

      if (cached.length > 0) {
        // Cache exists → show instantly
        console.log("[RELOAD] Showing cached list instantly");
        setChatMembers({ data: cached, total: cached.length });
        setLoading(false);
        setShowEmptyState(false);
      } else {
        // No cache → show syncing screen while preload fetches from API
        setPreloading(true);
      }

      loadMembers(1, true, "");

      preLoadConversations(1, pageSize, auth)
        .then(({ messagesByConversation }) => {
          if (cancelled) return;
          for (const [convId, rawMsgs] of messagesByConversation) {
            const normalized = normalizeServerMessages(rawMsgs, auth, convId);
            if (normalized.length > 0) {
              putMessages(auth, convId, normalized as never).catch(() => {});
            }
          }
          console.log("[RELOAD] Preloaded messages for", messagesByConversation.size, "conversations");
        })
        .catch(() => {
          /* ignore preload errors */
        })
        .finally(() => {
          if (!cancelled) setPreloading(false);
        });
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth?.token, auth?.userId]);

  // ── Real-time: UPDATE_CONVERSATION_ITEM ───────────────────────────────────
  useEffect(() => {
    const handleUpdateItem = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (!detail) return;
      const conversationId = detail.ConversationId ?? detail.conversationId;
      if (conversationId == null) return;

      const isStatusChange = Boolean(detail.isStatusChange);
      const myId = Number(auth?.id ?? auth?.userId);
      const senderId = Number(detail.SenderId ?? detail.Sender);
      const isOutgoing = myId && senderId && myId === senderId;

      setChatMembers((prev) => {
        if (!prev?.data) return prev;
        const updatedData = [...prev.data];
        const idx = updatedData.findIndex(
          (m) => Number(m.ConversationId) === Number(conversationId)
        );

        // ── Phase 1: simple field merge (always) ──────────────────────────
        if (idx !== -1) {
          const existing = updatedData[idx] as Record<string, unknown>;
          const merged = { ...existing } as Record<string, unknown>;

          // Simple property merges
          if (detail.ProfileImageUrl !== undefined) merged.ProfileImageUrl = detail.ProfileImageUrl;
          if (detail.name !== undefined) merged.name = detail.name;
          if (detail.ConversationName !== undefined) merged.ConversationName = detail.ConversationName;
          if (detail.RemoveInGroup !== undefined) merged.RemoveInGroup = detail.RemoveInGroup;
          if (detail.IsStar !== undefined) merged.IsStar = detail.IsStar;
          if (detail.IsPin !== undefined) merged.IsPin = detail.IsPin;
          if (detail.IsArchived !== undefined) merged.IsArchived = detail.IsArchived;
          if (detail.IsAdmin !== undefined) merged.IsAdmin = detail.IsAdmin;
          if (detail.GroupMembers !== undefined) merged.GroupMembers = detail.GroupMembers;
          // Group permission fields
          if (detail.EditGroup !== undefined) merged.EditGroup = detail.EditGroup;
          if (detail.SendNewMessage !== undefined) merged.SendNewMessage = detail.SendNewMessage;
          if (detail.AddOtherMember !== undefined) merged.AddOtherMember = detail.AddOtherMember;
          if (detail.InviteToGroup !== undefined) merged.InviteToGroup = detail.InviteToGroup;
          if (detail.ApproveNewMembers !== undefined) merged.ApproveNewMembers = detail.ApproveNewMembers;
          if (detail.AllowDeleteForAll !== undefined) merged.AllowDeleteForAll = detail.AllowDeleteForAll;
          if (detail.avatarConfig !== undefined) merged.avatarConfig = detail.avatarConfig;
          if (detail.UnreadCount !== undefined) {
            merged.UnreadCount = detail.UnreadCount;
            merged.unreadCount = detail.UnreadCount;
          }

          // ── Phase 2: message update (only if Message/LastMessage present) ──
          const hasMessage = detail.Message !== undefined || detail.LastMessage !== undefined;

          if (hasMessage) {
            const currentChat = merged as Record<string, unknown>;
            const currentUnread = Number(currentChat.unreadCount ?? currentChat.UnreadCount ?? 0);

            // Build message preview
            const normalizedType = normalizeMessageType(
              detail.MessageType ?? detail.LastMessageType ?? currentChat.LastMessageType
            );
            const previewMsg = {
              Message: detail.Message ?? detail.LastMessage ?? currentChat.LastMessage ?? "",
              MessageType: normalizedType,
              SystemMsg: detail.SystemMsg ?? detail.LastMessageSystemMsg ?? currentChat.SystemMsg,
              IsDeletedForEveryone: detail.IsDeletedForEveryone,
            };
            const preview = getMessagePreview(previewMsg);
            const messagePreviewText = preview.text;
            const messagePreviewNode = preview.node;
            const dateTime = detail.DateTime || detail.LastMessageDate || detail.LastUpdatedDate;
            const formattedTime = formatDateTime(dateTime, "chatTimestamp");

            // Unread count logic (matches old handleSocketUpdate)
            const nextUnreadCount = (currentCount: number) => {
              if (isStatusChange || isOutgoing) return currentCount;
              return currentCount + 1;
            };
            const nextUnreadOnStatus = (currentCount: number) => {
              if (!isStatusChange) return currentCount;
              const raw = detail.MessageStatus ?? detail.Status;
              if (Number(raw) === 1) return 0;
              return currentCount;
            };

            const unreadAfterMsg = nextUnreadCount(currentUnread);
            const unreadFinal = nextUnreadOnStatus(unreadAfterMsg);

            // Check for duplicate message (skip update if same message)
            const incomingId = detail.MessageId ?? detail.Id;
            const isSameMessage = incomingId
              ? String(incomingId) === String(currentChat.LastMessageId)
              : (currentChat.lastMessageText === messagePreviewText &&
                 currentChat.lastMessageTime === formattedTime);

            if (isSameMessage && !isStatusChange) {
              updatedData[idx] = merged as ConversationListEntry;
              updatedData.sort(conversationComparator);
              return { ...prev, data: updatedData };
            }

            // Status-only update (no new message content)
            if (isStatusChange && !incomingId && !detail.Message) {
              merged.unreadCount = unreadFinal;
              merged.UnreadCount = unreadFinal;
              merged.LastMessageStatus = detail.MessageStatus ?? detail.Status ?? detail.status ?? currentChat.LastMessageStatus;
              updatedData[idx] = merged as ConversationListEntry;
              updatedData.sort(conversationComparator);
              return { ...prev, data: updatedData };
            }

            // Full message update
            merged.name = (String(currentChat.name ?? "").trim() && String(currentChat.name).trim() !== "Unknown")
              ? currentChat.name
              : (detail.ConversationName || getCustomerDisplayName(detail) || "Unknown");
            merged.lastMessage = messagePreviewNode;
            merged.lastMessageText = messagePreviewText;
            merged.lastMessageTime = formattedTime;
            // Set lastMessageTimeValue to NOW for new messages (not status changes)
            // This is what moves the conversation to the top of the list
            merged.lastMessageTimeValue = isStatusChange
              ? currentChat.lastMessageTimeValue
              : (() => {
                  const now = new Date();
                  const offset = now.getTimezoneOffset() * 60000;
                  return new Date(now.getTime() - offset).toISOString();
                })();
            merged.unreadCount = unreadFinal;
            merged.UnreadCount = unreadFinal;
            merged.LastMessage = detail.Message ?? currentChat.LastMessage;
            merged.LastMessageType = mapMessageTypeToCode(normalizedType);
            merged.LastMessageStatus = detail.MessageStatus ?? detail.Status ?? detail.status ?? currentChat.LastMessageStatus;
            merged.LastMessageDirection = isOutgoing ? 1 : 0;
            merged.LastMessageId = incomingId || currentChat.LastMessageId;
            merged.LastMessageDate = dateTime || currentChat.LastMessageDate;
            merged.LastUpdatedDate = dateTime || currentChat.LastUpdatedDate;
            merged.SystemMsg = detail.SystemMsg ?? detail.LastMessageSystemMsg ?? currentChat.SystemMsg;
            merged.IsDeletedForEveryone = detail.IsDeletedForEveryone ?? currentChat.IsDeletedForEveryone;
          }

          updatedData[idx] = merged as ConversationListEntry;
        } else if (detail.name || detail.ConversationName || detail.Message || detail.LastMessage !== undefined) {
          // ── New conversation (from CreateGroup, outgoing message, etc.) ──
          const resolvedName = detail.ConversationName || detail.name || getCustomerDisplayName(detail) || "Unknown";
          const normalizedType = normalizeMessageType(detail.MessageType ?? detail.LastMessageType);
          const previewMsg = {
            Message: detail.Message ?? detail.LastMessage ?? "",
            MessageType: normalizedType,
            SystemMsg: detail.SystemMsg,
            IsDeletedForEveryone: detail.IsDeletedForEveryone,
          };
          const preview = getMessagePreview(previewMsg);
          const dateTime = detail.DateTime || detail.LastMessageDate || new Date().toISOString();
          const unread = isStatusChange || isOutgoing ? 0 : 1;

          const newCustomer = {
            ...detail,
            ConversationId: conversationId,
            ConversationName: resolvedName,
            name: resolvedName,
            IsGroup: detail.IsGroup ?? 0,
            LastMessage: detail.Message ?? detail.LastMessage ?? "",
            LastMessageType: mapMessageTypeToCode(normalizedType),
            LastMessageStatus: detail.MessageStatus ?? detail.Status ?? detail.status,
            LastMessageDirection: isOutgoing ? 1 : 0,
            LastMessageId: detail.MessageId ?? detail.Id ?? "",
            LastMessageDate: dateTime,
            LastUpdatedDate: dateTime,
            DateTime: dateTime,
            UnreadCount: unread,
            unreadCount: unread,
            IsAdmin: detail.IsAdmin ?? 0,
            IsStar: detail.IsStar ?? 0,
            IsPin: detail.IsPin ?? 0,
            IsArchived: detail.IsArchived ?? 0,
            IsDeletedForEveryone: detail.IsDeletedForEveryone ?? 0,
            GroupMembers: detail.GroupMembers || [],
            ProfileImageUrl: detail.ProfileImageUrl || detail.ProfileImage || "",
            ReceiverId: isOutgoing
              ? (detail.ReceiverId || detail.UserId || detail.CustomerId)
              : (detail.SenderId || detail.Sender || detail.UserId),
            lastMessage: preview.node,
            lastMessageText: preview.text,
            lastMessageTime: formatDateTime(dateTime, "chatTimestamp"),
            lastMessageTimeValue: dateTime,
            avatar: null,
            avatarConfig: getWhatsAppAvatarConfig(getCustomerAvatarSeed(detail) || resolvedName),
            isStatusChange,
          } as ConversationListEntry;
          updatedData.push(newCustomer);
        }

        updatedData.sort(conversationComparator);
        return { ...prev, data: updatedData };
      });
    };

    window.addEventListener("UPDATE_CONVERSATION_ITEM", handleUpdateItem as EventListener);
    return () => {
      window.removeEventListener("UPDATE_CONVERSATION_ITEM", handleUpdateItem as EventListener);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth?.id, auth?.userId]);

  // ── Real-time: UPDATE_CONVERSATION_MUTE ────────────────────────────────────
  useEffect(() => {
    const handleUpdateMute = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (!detail?.conversationId) return;
      const { conversationId, isMuted, muteExpiresAt } = detail;
      setChatMembers((prev) => {
        if (!prev?.data) return prev;
        const updatedData = prev.data.map((c) =>
          Number(c.ConversationId) === Number(conversationId)
            ? { ...c, IsMuted: isMuted, MuteExpiresAt: muteExpiresAt } as ConversationListEntry
            : c
        );
        return { ...prev, data: updatedData };
      });
    };

    window.addEventListener("UPDATE_CONVERSATION_MUTE", handleUpdateMute as EventListener);
    return () => {
      window.removeEventListener("UPDATE_CONVERSATION_MUTE", handleUpdateMute as EventListener);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // interval resumes.
  const authRef = useRef(auth);
  useEffect(() => {
    authRef.current = auth;
  }, [auth]);

  useEffect(() => {
    const CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

    const scanForExpiredMutes = () => {
      const currentAuth = authRef.current;
      if (!currentAuth) return;
      setChatMembers((prev) => {
        if (!prev?.data) return prev;
        const expired: Array<{ id: string | number; name: string }> = [];
        for (const c of prev.data) {
          const isMuted = (c as any)?.IsMuted;
          const expiresAt = (c as any)?.MuteExpiresAt;
          // Only consider mutes with a real expiry (skip "always" mutes)
          if (Number(isMuted) !== 1 || !expiresAt) continue;
          if (new Date(expiresAt).getTime() <= Date.now()) {
            expired.push({
              id: c.ConversationId as string | number,
              name: (c as any)?.name ?? "",
            });
          }
        }
        if (expired.length === 0) return prev;
        // Fire unmute API calls + dispatch UI updates for each expired mute.
        // These run async and don't block the state update below.
        for (const ex of expired) {
          muteConversationApi(currentAuth, {
            conversationId: ex.id,
            isMuted: 0,
            muteExpiresAt: null,
          }).catch((e) => console.error("auto-unmute error:", e));
          window.dispatchEvent(
            new CustomEvent("UPDATE_CONVERSATION_MUTE", {
              detail: { conversationId: ex.id, isMuted: 0, muteExpiresAt: null },
            })
          );
        }
        // Optimistically update local state so the icon disappears immediately
        const updatedData = prev.data.map((c) =>
          expired.some((ex) => Number(ex.id) === Number(c.ConversationId))
            ? ({ ...c, IsMuted: 0, MuteExpiresAt: null } as ConversationListEntry)
            : c
        );
        return { ...prev, data: updatedData };
      });
    };

    // Immediate check on mount (in case mutes already expired before load)
    scanForExpiredMutes();

    const intervalId = setInterval(() => {
      // Skip the scan while the tab is hidden — no point checking when the
      // user isn't looking. visibilitychange handler below catches up on focus.
      if (document.visibilityState === "hidden") return;
      scanForExpiredMutes();
    }, CHECK_INTERVAL_MS);

    // Run an immediate scan whenever the tab becomes visible again — this
    // catches any mutes that expired while the tab was in the background.
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        scanForExpiredMutes();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Real-time: DELETE_CONVERSATION_ITEM / DELETE_CONVERSATION ─────────────
  useEffect(() => {
    const handleRemoveEvent = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      const conversationId = detail?.conversationId ?? detail?.ConversationId;
      if (!conversationId) return;
      setChatMembers((prev) => {
        if (!prev?.data) return prev;
        const updatedData = prev.data.filter(
          (it) => Number(it.ConversationId) !== Number(conversationId)
        );
        return { ...prev, data: updatedData };
      });
    };

    window.addEventListener("DELETE_CONVERSATION_ITEM", handleRemoveEvent as EventListener);
    window.addEventListener("DELETE_CONVERSATION", handleRemoveEvent as EventListener);
    return () => {
      window.removeEventListener("DELETE_CONVERSATION_ITEM", handleRemoveEvent as EventListener);
      window.removeEventListener("DELETE_CONVERSATION", handleRemoveEvent as EventListener);
    };
  }, []);

  // ── Real-time: CHAT_DRAFTS_UPDATED + IndexedDB hydration ──────────────────
  useEffect(() => {
    // Hydrate drafts from IndexedDB on mount/auth change.
    let cancelled = false;
    (async () => {
      try {
        const all = await getAllDrafts(auth);
        if (!cancelled) setDrafts(all as Record<number, string>);
      } catch {
        /* ignore */
      }
    })();

    const handleDraftsUpdate = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail) {
        setDrafts({ ...detail });
      }
    };

    window.addEventListener("CHAT_DRAFTS_UPDATED", handleDraftsUpdate as EventListener);
    return () => {
      cancelled = true;
      window.removeEventListener("CHAT_DRAFTS_UPDATED", handleDraftsUpdate as EventListener);
    };
  }, [auth]);

  // ── Cleanup ───────────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
      if (fetchControllerRef.current) fetchControllerRef.current.abort();
    };
  }, []);

  return {
    chatMembers,
    loading,
    preloading,
    searchLoading,
    hasMore,
    currentPage,
    typingStates,
    drafts,
    showEmptyState,
    serviceDown,
    serviceMessage,
    loadMembers,
    handleSearchChange,
    clearSearch,
    setChatMembers,
    setShowEmptyState,
    searchTerm,
  };
};
