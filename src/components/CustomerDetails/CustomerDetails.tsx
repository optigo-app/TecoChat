"use client";

import { useState, useEffect, useContext, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import "./CustomerDetails.scss";
import {
  getCustomerAvatarSeed,
  getCustomerDisplayName,
  markImageAsDead,
  handleDownloadFile,
} from "../../utils/globalFunc";
import { useLoginContext, type AuthData } from "../../contexts/LoginData";
import { fetchMediaLists } from "../../API/MediaLists/MediaLists";
import { fetchGroupDetails } from "../../API/Groups/FetchGroupDetails";
import { changeGroupPermissionApi } from "../../API/Groups/ChangeGroupPermissionApi";
import { editGroupApi } from "../../API/Groups/EditGroupApi";
import { addGroupParticipantApi } from "../../API/Groups/AddGroupParticipantApi";
import { assignRoleApi } from "../../API/Groups/AssignRoleApi";
import { multiAssignRoleApi } from "../../API/Groups/MultiAssignRoleApi";
import { removeMemberApi } from "../../API/Groups/RemoveMemberApi";
import { updateConversationApi } from "../../API/SendMessage/updateConversationApi";
import { clearChatApi } from "../../API/ClearChat/ClearChatApi";
import { deleteConversationApi } from "../../API/ConversationView/DeleteConversationApi";
import { contactInfoApi } from "../../API/SendMessage/ContactInfoApi";
import { muteConversationApi } from "../../API/ConversationMute/MuteConversationApi";
import { isConversationMuted } from "../../utils/mentionUtils";
import { showToast } from "../../utils/toastHelper";
import DetailsHeader from "./DetailsHeader";
import DetailsViews from "./DetailsViews";
import MemberActions from "./MemberActions";
import GroupDialogs from "./GroupDialogs";
import ConfirmationDialog from "../ReusableComponent/ConfirmationDialog";
import { useFavorite } from "../../contexts/FavoriteContext";
import { useRemoveInGroup } from "../../contexts/RemoveInGroupContext";
import { useGroupAdminMode } from "../../contexts/GroupAdminModeContext";
import AddMemberDialog from "../ReusableComponent/AddMemberDialog";
const MediaViewer = dynamic(() => import("../ChatPanel/messages/viewer/MediaViewer"), { ssr: false });
import type { MediaViewerItem } from "../ChatPanel/CoreLogic/uiReducer";
import type { ConversationListEntry } from "../../types/conversation";
import type { ChatMessage } from "../../types/message";
import { clearConversation } from "../../db/messageCache";
import { deleteDraft } from "../../db/draftCache";

// ── Types ────────────────────────────────────────────────────────────────────

interface MediaItem {
  Id?: string | number;
  FileUrl?: string;
  FileName?: string;
  MimeType?: string;
  src?: string;
  name?: string;
  type?: string;
  [key: string]: unknown;
}

interface MediaItems {
  images: MediaItem[];
  videos: MediaItem[];
  documents: MediaItem[];
}

interface PaginationState {
  page: number;
  hasMore: boolean;
  isLoading: boolean;
}

interface Pagination {
  images: PaginationState;
  videos: PaginationState;
  documents: PaginationState;
}

interface GroupPermissionsData {
  editGroupSettings?: boolean;
  sendMessages?: boolean;
  addOtherMembers?: boolean;
  inviteToGroup?: boolean;
  approveNewMembers?: boolean;
  AllowDeleteForAll?: boolean;
  editGroupAdmins?: boolean;
  [key: string]: boolean | undefined;
}

interface GroupMember {
  UserId: string | number;
  Name?: string;
  MemberName?: string;
  IsAdmin?: number | boolean;
  ProfileImageUrl?: string;
  ProfileImage?: string;
  About?: string;
  ConversationId?: string | number;
  [key: string]: unknown;
}

interface LocalGroupData {
  members: any[];
  description?: string;
  name?: string;
  createdBy?: string | null;
  entryDate?: string | null;
  createdById?: string | number | null;
  isPastParticipant?: number;
  [key: string]: unknown;
}

interface ConfirmationModalState {
  isOpen: boolean;
  member: GroupMember | null;
  actionType: string | null;
}

interface CustomerDetailsProps {
  customer: ConversationListEntry;
  onClose: () => void;
  open: boolean;
  variant?: "drawer" | "panel";
  initialViewState?: string;
  messageInfo?: ChatMessage | null;
  messages?: ChatMessage[];
  scrollToMessage?: (
    messageId: string | number,
    containerRef: React.MutableRefObject<HTMLElement | null>,
    attachmentId?: string | null,
    searchQuery?: string | null
  ) => void;
  searchResults?: ChatMessage[];
  isSearching?: boolean;
  onSearchMessages?: (query: string) => void;
  onSearchByDate?: (date: string) => void;
  containerRef?: React.MutableRefObject<HTMLElement | null>;
}

// ── Component ────────────────────────────────────────────────────────────────

const CustomerDetails = ({
  customer,
  onClose,
  open,
  variant = "drawer",
  initialViewState = "info",
  messageInfo = null,
  messages = [],
  scrollToMessage,
  searchResults = [],
  isSearching = false,
  onSearchMessages,
  onSearchByDate,
  containerRef,
}: CustomerDetailsProps) => {
  const { auth } = useLoginContext();

  const [currentViewState, setCurrentViewState] = useState(initialViewState);
  const [direction, setDirection] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("media");
  const [mediaItems, setMediaItems] = useState<MediaItems>({
    images: [],
    videos: [],
    documents: [],
  });
  const [groupPermissions, setGroupPermissions] = useState<GroupPermissionsData>({
    editGroupSettings: true,
    sendMessages: true,
    addOtherMembers: true,
    inviteToGroup: false,
    approveNewMembers: false,
    AllowDeleteForAll: true,
    editGroupAdmins: true,
  });
  const [pagination, setPagination] = useState<Pagination>({
    images: { page: 1, hasMore: true, isLoading: false },
    videos: { page: 1, hasMore: true, isLoading: false },
    documents: { page: 1, hasMore: true, isLoading: false },
  });
  const [showAllMembers, setShowAllMembers] = useState(false);
  const [contactInfoData, setContactInfoData] = useState<any>(null);
  const [contactInfoLoading, setContactInfoLoading] = useState(false);
  const [groupInfoLoading, setGroupInfoLoading] = useState(false);
  const [localGroupData, setLocalGroupData] = useState<LocalGroupData>({
    members: (customer?.GroupMembers as GroupMember[]) || [],
    description: (customer?.GroupDesc as string) || "",
    name: (customer?.ConversationName as string) || "",
    createdBy: null,
    entryDate: null,
    createdById: null,
    isPastParticipant: 0,
  });

  // Editing states
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [editedName, setEditedName] = useState("");
  const [editedDesc, setEditedDesc] = useState("");

  // Dialog states
  const [isAddMemberDialogOpen, setIsAddMemberDialogOpen] = useState(false);
  const [isParticipantSearchOpen, setIsParticipantSearchOpen] = useState(false);
  const [isEditAdminDialogOpen, setIsEditAdminDialogOpen] = useState(false);
  const [isPastParticipantsOpen, setIsPastParticipantsOpen] = useState(false);

  // Media viewer state
  const [mediaOpen, setMediaOpen] = useState(false);
  const [initialMediaIndex, setInitialMediaIndex] = useState(0);
  const [mediaViewerItems, setMediaViewerItems] = useState<MediaViewerItem[]>([]);

  // Confirmation modal state
  const [confirmationModal, setConfirmationModal] = useState<ConfirmationModalState>({
    isOpen: false,
    member: null,
    actionType: null,
  });

  // Member menu state
  const [memberMenuAnchorEl, setMemberMenuAnchorEl] = useState<HTMLElement | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const [muteLoading, setMuteLoading] = useState(false);

  // Contexts
  const { favoriteState, updateFavoriteStatus } = useFavorite();
  const { isRemovedFromGroup, updateRemoveInGroupStatus } = useRemoveInGroup();
  const { updateGroupAdminMode, groupSettingsState, updateGroupSettings } = useGroupAdminMode();

  // Guard: CustomerDetails renders for real conversations OR for new-chat
  // contacts (no ConversationId yet) that have a UserId/id. The contact-info
  // API only needs a UserId, so we can show profile + contact info before the
  // conversation is started.
  // Default to "" so the type stays `string | number` (no undefined) — this
  // preserves all downstream `if (conversationId)` checks.
  const conversationId = (customer?.ConversationId as string | number) ?? "";
  const contactUserId =
    (customer as any)?.UserId || (customer as any)?.id || (customer as any)?.ReceiverId || "";

  // Clear search query when chat is cleared (messages are gone, so search
  // results are stale)
  useEffect(() => {
    const handleClear = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      const targetId = detail?.conversationId ?? detail?.ConversationId;
      if (!targetId || (conversationId && Number(targetId) === Number(conversationId))) {
        setSearchQuery("");
      }
    };
    window.addEventListener("CLEAR_CONVERSATION_MESSAGES", handleClear as EventListener);
    return () => {
      window.removeEventListener("CLEAR_CONVERSATION_MESSAGES", handleClear as EventListener);
    };
  }, [conversationId]);

  // Derived state
  const isFavorite =
    favoriteState[conversationId ?? 0]?.isStar ?? (customer?.IsStar === 1);
  const isRemovedFromCurrentGroup =
    (conversationId ? isRemovedFromGroup(conversationId) : false) || (customer?.RemoveInGroup === 1);

  const pageSize = 6;
  const enablePagination = true;
  const inFlightRequestsRef = useRef(new Set<string>());
  const fetchedPagesRef = useRef(new Set<string>());
  const isMountedRef = useRef(true);

  // Set isMountedRef to false on unmount so async loaders can bail
  // before calling setState on an unmounted component.
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // ── Media helpers ──────────────────────────────────────────────────────────

  const getItemKey = (item: MediaItem): string | number | undefined => item?.Id ?? item?.FileUrl;

  const mergeUniqueByKey = (
    prevList: MediaItem[],
    nextList: MediaItem[]
  ): MediaItem[] => {
    const map = new Map<string | number | undefined, MediaItem>();
    (prevList || []).forEach((it) => {
      const k = getItemKey(it);
      if (k != null) map.set(k, it);
    });
    (nextList || []).forEach((it) => {
      const k = getItemKey(it);
      if (k != null) map.set(k, it);
    });
    return Array.from(map.values());
  };

  const processMediaItems = (items: MediaItem[]): MediaItems => {
    const categorized: MediaItems = { images: [], videos: [], documents: [] };
    items.forEach((item) => {
      const mimeType = (item.MimeType as string) || "";
      const mediaItem: MediaItem = {
        ...item,
        src: item.FileUrl as string,
        name: item.FileName as string,
        type: mimeType,
      };
      if (mimeType.startsWith("image/")) {
        categorized.images.push(mediaItem);
      } else if (mimeType.startsWith("video/")) {
        categorized.videos.push(mediaItem);
      } else {
        categorized.documents.push(mediaItem);
      }
    });
    return categorized;
  };

  const fetchMediaData = useCallback(
    async (type: "images" | "videos" | "documents", page: number = 1) => {
      if (!conversationId) return;
      const effectiveUserId =
        customer.IsGroup === 1 ? 0 : ((customer as any).id || (customer as any).UserId || 0);
      const requestKey = `${conversationId}:${effectiveUserId}:${page}`;
      if (inFlightRequestsRef.current.has(requestKey) || fetchedPagesRef.current.has(requestKey))
        return;
      inFlightRequestsRef.current.add(requestKey);
      if (pagination[type]?.isLoading) {
        inFlightRequestsRef.current.delete(requestKey);
        return;
      }
      setPagination((prev) => ({
        ...prev,
        [type]: { ...prev[type], isLoading: true },
      }));
      try {
        const response = await fetchMediaLists(
          page,
          pageSize,
          conversationId,
          auth as AuthData,
          effectiveUserId
        );
        if (response?.data) {
          if (!isMountedRef.current) return;
          const categorized = processMediaItems(response.data as MediaItem[]);
          setMediaItems((prev) => ({
            images:
              page === 1 ? categorized.images : mergeUniqueByKey(prev.images, categorized.images),
            videos:
              page === 1 ? categorized.videos : mergeUniqueByKey(prev.videos, categorized.videos),
            documents:
              page === 1
                ? categorized.documents
                : mergeUniqueByKey(prev.documents, categorized.documents),
          }));
          const hasMoreItems = (response.data as MediaItem[]).length === pageSize;
          setPagination((prev) => ({
            images: { ...prev.images, page, hasMore: hasMoreItems, isLoading: false },
            videos: { ...prev.videos, page, hasMore: hasMoreItems, isLoading: false },
            documents: { ...prev.documents, page, hasMore: hasMoreItems, isLoading: false },
          }));
          fetchedPagesRef.current.add(requestKey);
        }
      } catch (error) {
        console.error(`Error fetching ${type}:`, error);
        if (!isMountedRef.current) return;
        setPagination((prev) => ({
          ...prev,
          [type]: { ...prev[type], hasMore: false, isLoading: false },
        }));
      } finally {
        inFlightRequestsRef.current.delete(requestKey);
      }
    },
    [customer, auth, pagination]
  );

  const loadMoreMedia = () => {
    if (!pagination.images.isLoading && pagination.images.hasMore) {
      fetchMediaData("images", pagination.images.page + 1);
    }
  };

  const loadMoreDocuments = () => {
    if (!pagination.documents.isLoading && pagination.documents.hasMore) {
      fetchMediaData("documents", pagination.documents.page + 1);
    }
  };

  // ── Effects ────────────────────────────────────────────────────────────────

  // Reset media when customer changes
  useEffect(() => {
    if (conversationId) {
      setMediaItems({ images: [], videos: [], documents: [] });
      setPagination({
        images: { page: 1, hasMore: true, isLoading: false },
        videos: { page: 1, hasMore: true, isLoading: false },
        documents: { page: 1, hasMore: true, isLoading: false },
      });
      inFlightRequestsRef.current.clear();
      fetchedPagesRef.current.clear();
    }
  }, [conversationId, (customer as any).id, (customer as any).UserId]);

  // Sync permissions from customer/global state
  useEffect(() => {
    if (customer && customer.IsGroup === 1) {
      const globalSettings = (conversationId ? groupSettingsState[conversationId] : {}) || {};
      setGroupPermissions({
        editGroupSettings:
          globalSettings.EditGroup !== undefined
            ? globalSettings.EditGroup === 1
            : (customer as any).EditGroup === 1 || (customer as any).EditGroup === true,
        sendMessages:
          globalSettings.SendNewMessage !== undefined
            ? globalSettings.SendNewMessage === 1
            : (customer as any).SendNewMessage === 1 || (customer as any).SendNewMessage === true,
        addOtherMembers:
          globalSettings.AddOtherMember !== undefined
            ? globalSettings.AddOtherMember === 1
            : (customer as any).AddOtherMember === 1 || (customer as any).AddOtherMember === true,
        inviteToGroup:
          globalSettings.InviteToGroup !== undefined
            ? globalSettings.InviteToGroup === 1
            : (customer as any).InviteToGroup === 1 || (customer as any).InviteToGroup === true,
        approveNewMembers:
          globalSettings.ApproveNewMembers !== undefined
            ? globalSettings.ApproveNewMembers === 1
            : (customer as any).ApproveNewMembers === 1 ||
              (customer as any).ApproveNewMembers === true,
        AllowDeleteForAll:
          globalSettings.AllowDeleteForAll !== undefined
            ? globalSettings.AllowDeleteForAll === 1
            : (customer as any).AllowDeleteForAll === 1 ||
              (customer as any).AllowDeleteForAll === true,
        editGroupAdmins: true,
      });
    }
  }, [customer, groupSettingsState]);

  // Update RemoveInGroup context
  useEffect(() => {
    if (conversationId && (customer as any).RemoveInGroup !== undefined) {
      updateRemoveInGroupStatus(conversationId, (customer as any).RemoveInGroup === 1);
    }
  }, [conversationId, (customer as any).RemoveInGroup, updateRemoveInGroupStatus]);

  // Fetch group details and initial media when opened
  useEffect(() => {
    if (open && conversationId) {
      if (customer.IsGroup === 1) {
        loadGroupInfo();
      }
      fetchMediaData("images", 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, conversationId, (customer as any).id, (customer as any).UserId]);

  // Fetch contact info for non-group contacts. Works with OR without a
  // ConversationId — the contactInfoApi only needs a UserId.
  useEffect(() => {
    if (open && customer.IsGroup !== 1 && (conversationId || contactUserId)) {
      setContactInfoData(null);
      setContactInfoLoading(true);
      loadContactInfo();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, conversationId, contactUserId, (customer as any).ReceiverId, (customer as any).UserId, (customer as any).id]);

  // Fetch full media when navigating to media view
  useEffect(() => {
    if (open && currentViewState === "media" && conversationId) {
      fetchMediaData("images", 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, currentViewState, conversationId, (customer as any).id, (customer as any).UserId]);

  // Sync initialViewState
  useEffect(() => {
    if (open && initialViewState) {
      setCurrentViewState((prev) => {
        if (prev !== initialViewState) {
          setDirection("forward");
          return initialViewState;
        }
        return prev;
      });
    }
  }, [open, initialViewState]);

  // Escape key to close
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose?.();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    if (variant !== "panel") {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prevOverflow;
        window.removeEventListener("keydown", onKeyDown);
      };
    }
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose, variant]);

  // Guard: render for real conversations OR for new-chat contacts (no
  // ConversationId yet) that have a UserId/id. contactUserId is declared above
  // with the other derived state (before hooks).
  if (!conversationId && !contactUserId) return null;
  const hasConversation = Boolean(conversationId);

  // ── Data loaders ───────────────────────────────────────────────────────────

  const loadGroupInfo = async () => {
    setGroupInfoLoading(true);
    try {
      const data = await fetchGroupDetails(conversationId, auth as AuthData);
      if (!isMountedRef.current) return;
      if (data) {
        if (data.groupDetails) {
          const gd = data.groupDetails as any;
          updateGroupSettings(conversationId, {
            EditGroup: gd.EditGroup,
            SendNewMessage: gd.SendNewMessage,
            AddOtherMember: gd.AddOtherMember,
            InviteToGroup: gd.InviteToGroup,
            ApproveNewMembers: gd.ApproveNewMembers,
            AllowDeleteForAll: gd.AllowDeleteForAll,
          });
          updateGroupAdminMode(conversationId, gd.SendNewMessage === 0);
          setLocalGroupData((prev) => ({
            ...prev,
            description: gd.Description || gd.GroupDesc || "",
            name: gd.Name || gd.ConversationName || "",
            createdBy: gd.CreatedByName || gd.CreatedBy || null,
            entryDate: gd.EntryDate || null,
            createdById: gd.CreatedBy ?? null,
            isPastParticipant: gd.IsPastParticipant || 0,
          }));
          // Sync mute status from group details response via event
          window.dispatchEvent(
            new CustomEvent("UPDATE_CONVERSATION_MUTE", {
              detail: {
                conversationId,
                isMuted: gd.IsMuted ?? 0,
                muteExpiresAt: gd.MuteExpiresAt ?? null,
              },
            })
          );
        }
        if (data.members) {
          const mappedMembers: GroupMember[] = data.members.map((m: any) => ({
            ...m,
            UserId: m.UserId,
            Name: m.MemberName,
            ProfileImageUrl: m.ProfileImage,
            IsAdmin: m.IsGroupAdmin === 1,
            About: "",
          }));
          setLocalGroupData((prev) => ({ ...prev, members: mappedMembers }));
        }
      }
    } catch (error) {
      console.error("Error fetching group details:", error);
    } finally {
      if (isMountedRef.current) setGroupInfoLoading(false);
    }
  };

  const loadContactInfo = async () => {
    try {
      const apiContactUserId =
        (customer as any).ReceiverId || (customer as any).id || (customer as any).UserId;
      const response = await contactInfoApi(auth as AuthData, { contactUserId: apiContactUserId });
      if (!isMountedRef.current) return;
      if (response?.Status === "200" || response?.success) {
        const contactData = response?.Data?.rd?.[0] || response?.Data || null;
        setContactInfoData(contactData);
      } else {
        setContactInfoData(null);
      }
    } catch (error) {
      console.error("Error fetching contact info:", error);
      if (!isMountedRef.current) return;
      setContactInfoData(null);
    } finally {
      if (isMountedRef.current) setContactInfoLoading(false);
    }
  };

  // ── Permission handling ────────────────────────────────────────────────────

  const handlePermissionChange = async (name: string, value: boolean) => {
    if (name === "inviteToGroup" || name === "approveNewMembers") {
      showToast(`${name} — coming soon!`, "info");
      return;
    }
    setGroupPermissions((prev) => ({ ...prev, [name]: value }));
    const permissionMap: Record<string, string> = {
      editGroupSettings: "EditGroup",
      sendMessages: "SendNewMessage",
      addOtherMembers: "AddOtherMember",
      inviteToGroup: "inviteToGroup",
      approveNewMembers: "ApproveNewMembers",
      AllowDeleteForAll: "AllowDeleteForAll",
    };
    const apiPermissionName = permissionMap[name];
    if (!apiPermissionName) return;
    try {
      const response = await changeGroupPermissionApi(auth as AuthData, {
        conversationId: conversationId,
        permissionName: apiPermissionName,
        permissionValue: value,
      });
      if (response?.Status === "200") {
        if (response?.Data?.rd?.[0]?.stat === 0) {
          showToast(
            response?.Data?.rd?.[0]?.stat_msg || "Only group admins can change permissions.",
            "error"
          );
          return;
        }
        updateGroupSettings(conversationId, {
          [apiPermissionName]: value ? 1 : 0,
        });
        // Keep selectedCustomer / conversation list in sync so context menu
        // and delete dialog reflect the new permission immediately.
        window.dispatchEvent(
          new CustomEvent("UPDATE_CONVERSATION_ITEM", {
            detail: {
              ConversationId: conversationId,
              [apiPermissionName]: value ? 1 : 0,
            },
          })
        );
        if (name === "sendMessages") {
          updateGroupAdminMode(conversationId, value === false);
        }
        const friendlyNames: Record<string, string> = {
          editGroupSettings: "Edit group settings",
          sendMessages: "Send messages",
          addOtherMembers: "Add members",
          inviteToGroup: "Invite to group",
          approveNewMembers: "Approve new members",
          AllowDeleteForAll: "Allow delete for everyone",
        };
        const friendlyName = friendlyNames[name] || "Permission";
        showToast(
          `${friendlyName} ${value ? "Permission enabled" : "Permission disabled"}`,
          "success"
        );
      } else {
        setGroupPermissions((prev) => ({ ...prev, [name]: !value }));
        showToast(response?.Message || "Failed to update permission", "error");
      }
    } catch (error) {
      setGroupPermissions((prev) => ({ ...prev, [name]: !value }));
      showToast("Internal server error occurred", "error");
    }
  };

  // ── Name/Desc editing ──────────────────────────────────────────────────────

  const handleSaveName = async () => {
    if (!editedName.trim() || editedName === localGroupData.name) {
      setIsEditingName(false);
      return;
    }
    if (editedName.length > 50) {
      showToast("Group name cannot exceed 50 characters", "error");
      return;
    }
    try {
      const response = await editGroupApi(auth as AuthData, {
        conversationId: conversationId,
        groupName: editedName,
        groupDesc: "",
        groupProfile: "",
      });
      if (response?.Status === "200") {
        if (response?.Data?.rd?.[0]?.stat === 0) {
          showToast(
            response?.Data?.rd?.[0]?.stat_msg || "Only group admins can edit this group.",
            "error"
          );
          return;
        }
        setLocalGroupData((prev) => ({ ...prev, name: editedName }));
        setIsEditingName(false);
        showToast("Group name updated", "success");
        window.dispatchEvent(
          new CustomEvent("UPDATE_CONVERSATION_ITEM", {
            detail: {
              ConversationId: conversationId,
              name: editedName,
              ConversationName: editedName,
              isStatusChange: true,
            },
          })
        );
      } else {
        showToast(response?.Message || "Failed to update name", "error");
      }
    } catch (error) {
      showToast("Error updating name", "error");
    }
  };

  const handleSaveDesc = async () => {
    if (editedDesc === localGroupData.description) {
      setIsEditingDesc(false);
      return;
    }
    if (editedDesc.length > 256) {
      showToast("Group description cannot exceed 256 characters", "error");
      return;
    }
    try {
      const response = await editGroupApi(auth as AuthData, {
        conversationId: conversationId,
        groupName: "",
        groupDesc: editedDesc,
        groupProfile: "",
      });
      if (response?.Status === "200") {
        if (response?.Data?.rd?.[0]?.stat === 0) {
          showToast(
            response?.Data?.rd?.[0]?.stat_msg || "Only group admins can edit this group.",
            "error"
          );
          return;
        }
        setLocalGroupData((prev) => ({ ...prev, description: editedDesc }));
        setIsEditingDesc(false);
        showToast("Group description updated", "success");
        window.dispatchEvent(
          new CustomEvent("UPDATE_CONVERSATION_ITEM", {
            detail: {
              ConversationId: conversationId,
              GroupDesc: editedDesc,
              Description: editedDesc,
              isStatusChange: true,
            },
          })
        );
      } else {
        showToast(response?.Message || "Failed to update description", "error");
      }
    } catch (error) {
      showToast("Error updating description", "error");
    }
  };

  const startEditingName = () => {
    setEditedName(
      customer?.IsGroup === 1 ? localGroupData?.name || "" : displayName || ""
    );
    setIsEditingName(true);
  };

  const startEditingDesc = () => {
    setEditedDesc(localGroupData?.description || "");
    setIsEditingDesc(true);
  };

  // ── Member management ──────────────────────────────────────────────────────

  const handleOpenAddMember = () => setIsAddMemberDialogOpen(true);

  const handleAddMembersSubmit = async (selectedIds: (string | number)[]) => {
    if (!selectedIds || selectedIds.length === 0) return;
    try {
      const response = await addGroupParticipantApi(auth as AuthData, {
        conversationId: conversationId,
        selectedMembers: selectedIds,
      });
      if (response?.Status === "200") {
        if (response?.Data?.rd?.[0]?.stat === 0) {
          showToast(response?.Data?.rd?.[0]?.stat_msg || "Failed to add members", "error");
          return;
        }
        showToast("Members added successfully", "success");
        setIsAddMemberDialogOpen(false);
        loadGroupInfo();
      } else {
        showToast(response?.Message || "Failed to add members", "error");
      }
    } catch (error) {
      showToast("Error adding members", "error");
    }
  };

  const handleEditAdminsSubmit = async (selectedIds: (string | number)[]) => {
    setIsEditAdminDialogOpen(false);
    if (!selectedIds) return;
    try {
      const currentAdmins = localGroupData.members
        .filter((m) => m.IsAdmin === 1 || m.IsAdmin === true)
        .map((m) => m.UserId);
      const changes: { UserId: string | number; IsGroupAdmin: number }[] = [];
      selectedIds.forEach((id) => {
        if (!currentAdmins.includes(id)) {
          changes.push({ UserId: id, IsGroupAdmin: 1 });
        }
      });
      currentAdmins.forEach((id) => {
        if (!selectedIds.includes(id) && id !== localGroupData.createdById) {
          changes.push({ UserId: id, IsGroupAdmin: 0 });
        }
      });
      if (changes.length === 0) return;
      const response = await multiAssignRoleApi(auth as AuthData, {
        conversationId: conversationId,
        adminChanges: changes,
      });
      if (response?.Status === "200") {
        showToast("Admins updated successfully", "success");
        loadGroupInfo();
      } else {
        showToast(response?.Message || "Failed to update admins", "error");
      }
    } catch (error) {
      console.error("Error updating admins:", error);
      showToast("Error updating admins", "error");
    }
  };

  const isCurrentUserAdmin = localGroupData.members.find(
    (m) => m.UserId === (auth?.id || auth?.userId)
  )?.IsAdmin;

  const handleMemberClick = (event: React.MouseEvent, member: GroupMember) => {
    if (member.UserId === (auth?.id || auth?.userId)) return;
    event.preventDefault();
    setConfirmationModal((prev) => ({ ...prev, member }));
    if (event.type === "contextmenu") {
      setMenuPosition({ top: event.clientY, left: event.clientX });
      setMemberMenuAnchorEl(null);
    } else {
      setMenuPosition(null);
      setMemberMenuAnchorEl(event.currentTarget as HTMLElement);
    }
  };

  const handleMenuAction = (action: string) => {
    if (action === "clearChat") {
      setConfirmationModal({ isOpen: true, member: null, actionType: "clearChat" });
    } else if (action === "makeAdmin" || action === "removeAdmin") {
      setConfirmationModal((prev) => ({ ...prev, isOpen: true, actionType: "roleUpdate" }));
    } else if (action === "removeMember") {
      setConfirmationModal((prev) => ({ ...prev, isOpen: true, actionType: "remove" }));
    } else if (action === "messageMember") {
      const member = confirmationModal.member;
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
        onClose?.();
      }
    } else if (action === "viewMember") {
      showToast("Contact info — coming soon!", "info");
    }
  };

  // ── Danger zone actions ────────────────────────────────────────────────────

  const handleClearChatClick = () => {
    setConfirmationModal({ isOpen: true, member: null, actionType: "clearChat" });
  };

  const handleDeleteChatClick = () => {
    setConfirmationModal({ isOpen: true, member: null, actionType: "deleteChat" });
  };

  const isOnlyAdmin = () => {
    const currentUserId = auth?.id || auth?.userId;
    const currentUser = localGroupData.members.find((m) => m.UserId === currentUserId);
    const isUserAdmin = currentUser?.IsAdmin;
    const adminCount = localGroupData.members.filter((m) => m.IsAdmin).length;
    return isUserAdmin && adminCount === 1;
  };

  const handleExitGroupClick = () => {
    if (isRemovedFromCurrentGroup) {
      setConfirmationModal({ isOpen: true, member: null, actionType: "deleteGroup" });
    } else if (isOnlyAdmin()) {
      setConfirmationModal({ isOpen: true, member: null, actionType: "adminCannotLeave" });
    } else {
      setConfirmationModal({ isOpen: true, member: null, actionType: "exitGroup" });
    }
  };

  const handleConfirmMemberAction = async () => {
    const { member, actionType } = confirmationModal;
    if (!actionType) return;

    if (actionType === "clearChat") {
      try {
        const response = await clearChatApi(auth as AuthData, {
          conversationId: conversationId,
          userId: auth?.id || auth?.userId,
        });
        if (response?.Status === "200" || response?.success === true) {
          showToast("Chat cleared successfully", "success");
          // Clear cached messages and draft from IndexedDB.
          clearConversation(auth, conversationId).catch(() => {});
          deleteDraft(auth, conversationId).catch(() => {});
          setConfirmationModal({ isOpen: false, member: null, actionType: null });
          window.dispatchEvent(
            new CustomEvent("CLEAR_CONVERSATION_MESSAGES", {
              detail: { conversationId: conversationId },
            })
          );
          window.dispatchEvent(
            new CustomEvent("UPDATE_CONVERSATION_ITEM", {
              detail: {
                ConversationId: conversationId,
                Message: "",
                lastMessageText: "",
                lastMessageTime: "",
                unreadCount: 0,
                isStatusChange: true,
              },
            })
          );
        } else {
          showToast(response?.Message || "Failed to clear chat", "error");
        }
      } catch (error) {
        console.error("Error clearing chat:", error);
        showToast("Error clearing chat", "error");
      }
      setConfirmationModal({ isOpen: false, member: null, actionType: null });
      return;
    }

    if (actionType === "adminCannotLeave") {
      setConfirmationModal({ isOpen: false, member: null, actionType: null });
      return;
    }

    if (actionType === "exitGroup") {
      try {
        const currentUserId = auth?.id || auth?.userId;
        const response = await removeMemberApi(auth as AuthData, {
          conversationId: conversationId,
          memberId: currentUserId,
        });
        if (response?.Status === "200") {
          showToast("You have left the group", "success");
          setConfirmationModal({ isOpen: false, member: null, actionType: null });
          updateRemoveInGroupStatus(conversationId, true);
          window.dispatchEvent(
            new CustomEvent("UPDATE_CONVERSATION_ITEM", {
              detail: {
                ConversationId: conversationId,
                RemoveInGroup: 1,
                isStatusChange: true,
              },
            })
          );
        } else {
          showToast(response?.Message || "Failed to exit group", "error");
        }
      } catch (error) {
        console.error("Error exiting group:", error);
        showToast("Error exiting group", "error");
      }
      return;
    }

    if (actionType === "deleteGroup" || actionType === "deleteChat") {
      try {
        const response = await deleteConversationApi(auth as AuthData, {
          conversationId: conversationId,
        });
        if (response?.Status === "200" || response?.success === true) {
          showToast(
            actionType === "deleteChat" ? "Chat deleted successfully" : "Group conversation deleted",
            "success"
          );
          setConfirmationModal({ isOpen: false, member: null, actionType: null });
          onClose?.();
          window.dispatchEvent(
            new CustomEvent("DELETE_CONVERSATION_ITEM", {
              detail: { conversationId: conversationId },
            })
          );
        } else {
          showToast(
            response?.Message ||
              `Failed to delete ${actionType === "deleteChat" ? "chat" : "group conversation"}`,
            "error"
          );
        }
      } catch (error) {
        console.error(
          `Error deleting ${actionType === "deleteChat" ? "chat" : "group conversation"}:`,
          error
        );
        showToast(
          `Error deleting ${actionType === "deleteChat" ? "chat" : "group conversation"}`,
          "error"
        );
      }
      return;
    }

    if (!member) return;
    try {
      let response;
      if (actionType === "roleUpdate") {
        response = await assignRoleApi(auth as AuthData, {
          conversationId: conversationId,
          memberId: member.UserId,
        });
      } else if (actionType === "remove") {
        response = await removeMemberApi(auth as AuthData, {
          conversationId: conversationId,
          memberId: member.UserId,
        });
      }
      if (response?.Status === "200") {
        if (response?.Data?.rd?.[0]?.stat === 0) {
          showToast(
            response?.Data?.rd?.[0]?.stat_msg ||
              `Failed to ${actionType === "roleUpdate" ? "update role" : "remove member"}`,
            "error"
          );
          setConfirmationModal({ isOpen: false, member: null, actionType: null });
          return;
        }
        const actionMsg =
          actionType === "roleUpdate"
            ? `${member.Name} is now ${member.IsAdmin ? "no longer an admin" : "an admin"}`
            : `${member.Name} removed from group`;
        showToast(actionMsg, "success");
        setConfirmationModal({ isOpen: false, member: null, actionType: null });
        loadGroupInfo();
      } else {
        showToast(
          response?.Message ||
            `Failed to ${actionType === "roleUpdate" ? "update role" : "remove member"}`,
          "error"
        );
      }
    } catch (error) {
      showToast(
        `Error during ${actionType === "roleUpdate" ? "role update" : "member removal"}`,
        "error"
      );
    }
  };

  // ── Media click ────────────────────────────────────────────────────────────

  const handleMediaClick = (media: MediaItem) => {
    const isImage =
      (media.type as string)?.startsWith("image/") ||
      (media.MimeType as string)?.startsWith("image/");
    const isVideo =
      (media.type as string)?.startsWith("video/") ||
      (media.MimeType as string)?.startsWith("video/");

    if (isImage || isVideo) {
      const allMedia = [
        ...(mediaItems.images || []),
        ...(mediaItems.videos || []),
      ];
      const index = allMedia.findIndex(
        (item) =>
          (item.Id && item.Id === media.Id) ||
          (item.FileUrl && item.FileUrl === media.FileUrl)
      );
      // Build MediaViewerItem list from images + videos
      const viewerItems: MediaViewerItem[] = allMedia.map((item) => ({
        src: (item.src as string) || (item.FileUrl as string) || "",
        type:
          ((item.type as string) || (item.MimeType as string) || "").startsWith("video/")
            ? "video"
            : "image",
        name: (item.name as string) || (item.FileName as string) || "",
        mimeType: (item.type as string) || (item.MimeType as string),
      }));
      setMediaViewerItems(viewerItems);
      setInitialMediaIndex(index >= 0 ? index : 0);
      setMediaOpen(true);
    } else {
      handleDownloadFile(
        (media.src as string) || (media.FileUrl as string) || "",
        (media.name as string) ||
          (media.FileName as string) ||
          `document_${media.Id}`
      );
    }
  };

  // ── Favorite toggle ────────────────────────────────────────────────────────

  const handleToggleFavorite = async () => {
    const newIsStar = isFavorite ? 0 : 1;
    updateFavoriteStatus(conversationId, newIsStar);
    try {
      const response = await updateConversationApi(auth as AuthData, {
        conversationId: conversationId,
        isPin: (customer as any)?.IsPin || 0,
        isStar: newIsStar,
        isArchived: (customer as any)?.IsArchived || 0,
      });
      if (response?.Status === "200" || response?.success === true) {
        showToast(newIsStar ? "Added to favorites" : "Removed from favorites", "success");
        window.dispatchEvent(
          new CustomEvent("UPDATE_CONVERSATION_ITEM", {
            detail: {
              ConversationId: conversationId,
              IsStar: newIsStar,
              isStatusChange: true,
            },
          })
        );
      } else {
        updateFavoriteStatus(conversationId, isFavorite ? 1 : 0);
        showToast("Failed to update favorite status", "error");
      }
    } catch (error) {
      updateFavoriteStatus(conversationId, isFavorite ? 1 : 0);
      showToast("Error updating favorite status", "error");
    }
  };

  // ── Profile upload/remove ──────────────────────────────────────────────────

  // ── Mute notification toggle ───────────────────────────────────────────────
  const isMuted = isConversationMuted(
    (customer as any)?.IsMuted,
    (customer as any)?.MuteExpiresAt
  );

  const handleToggleMute = async () => {
    if (!conversationId || !auth) return;
    setMuteLoading(true);
    try {
      const newIsMuted = isMuted ? 0 : 1;
      const expiresAt = null;
      const result = await muteConversationApi(auth as AuthData, {
        conversationId: conversationId,
        isMuted: newIsMuted as 0 | 1,
        muteExpiresAt: expiresAt,
      });
      if (result?.stat == 1) {
        window.dispatchEvent(
          new CustomEvent("UPDATE_CONVERSATION_MUTE", {
            detail: {
              conversationId: conversationId,
              isMuted: newIsMuted,
              muteExpiresAt: result.MuteExpiresAt ?? expiresAt,
            },
          })
        );
        showToast(
          newIsMuted === 1 ? "Notifications muted" : "Notifications unmuted",
          "success"
        );
      } else {
        showToast(result?.stat_msg || "Failed to update mute status", "error");
      }
    } catch (error) {
      console.error("handleToggleMute error:", error);
      showToast("Error updating mute status", "error");
    } finally {
      setMuteLoading(false);
    }
  };

  // ── Profile upload/remove (continued) ──────────────────────────────────────

  const handleProfileUploadComplete = async (imageUrl: string, _file: File) => {
    try {
      const response = await editGroupApi(auth as AuthData, {
        conversationId: conversationId,
        groupName: "",
        groupDesc: "",
        groupProfile: imageUrl,
      });
      if (response?.Status === "200") {
        if (response?.Data?.rd?.[0]?.stat === 0) {
          showToast(
            response?.Data?.rd?.[0]?.stat_msg || "Only group admins can edit this group.",
            "error"
          );
          return;
        }
        showToast("Group profile photo updated successfully", "success");
        loadGroupInfo();
        window.dispatchEvent(
          new CustomEvent("UPDATE_CONVERSATION_ITEM", {
            detail: {
              ConversationId: conversationId,
              ProfileImageUrl: imageUrl,
              isStatusChange: true,
            },
          })
        );
      } else {
        showToast(response?.Message || "Failed to update group profile", "error");
      }
    } catch (error) {
      console.error("Error updating group profile:", error);
      showToast("Error updating group profile", "error");
    }
  };

  const handleProfileRemoveComplete = async () => {
    try {
      const response = await editGroupApi(auth as AuthData, {
        conversationId: conversationId,
        groupName: "",
        groupDesc: "",
        groupProfile: "",
      });
      if (response?.Status === "200") {
        if (response?.Data?.rd?.[0]?.stat === 0) {
          showToast(
            response?.Data?.rd?.[0]?.stat_msg || "Only group admins can edit this group.",
            "error"
          );
          return;
        }
        showToast("Group profile photo removed successfully", "success");
        if ((customer as any)?.ProfileImageUrl) {
          markImageAsDead((customer as any).ProfileImageUrl);
        }
        loadGroupInfo();
        window.dispatchEvent(
          new CustomEvent("UPDATE_CONVERSATION_ITEM", {
            detail: {
              ConversationId: conversationId,
              ProfileImageUrl: "",
              isStatusChange: true,
            },
          })
        );
      } else {
        showToast(response?.Message || "Failed to remove group profile", "error");
      }
    } catch (error) {
      console.error("Error removing group profile:", error);
      showToast("Error removing group profile", "error");
    }
  };

  // ── Derived ────────────────────────────────────────────────────────────────

  const displayName = getCustomerDisplayName(customer);
  const avatarSeed = getCustomerAvatarSeed(customer);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      {variant !== "panel" ? (
        <div
          className={`customer-details-backdrop ${open ? "open" : ""}`}
          onClick={onClose}
        />
      ) : null}
      <div
        className={`customer-details-container ${variant === "panel" ? "panel" : ""} ${
          open ? "slide-in" : ""
        } ${open ? "visible" : ""}`}
        role="dialog"
        aria-modal={open ? "true" : "false"}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="details-content">
          <DetailsHeader
            currentViewState={currentViewState}
            initialViewState={initialViewState}
            onClose={onClose}
            onBack={() => {
              setDirection("backward");
              setCurrentViewState("info");
            }}
            isGroup={customer?.IsGroup === 1}
          />

          <div className="content-scroll">
            <DetailsViews
              open={open}
              currentViewState={currentViewState}
              direction={direction}
              customer={customer}
              isCurrentUserAdmin={isCurrentUserAdmin as boolean | undefined}
              avatarSeed={avatarSeed}
              localGroupData={localGroupData as any}
              displayName={displayName}
              isEditingName={isEditingName}
              setIsEditingName={setIsEditingName}
              editedName={editedName}
              setEditedName={setEditedName}
              handleSaveName={handleSaveName}
              startEditingName={startEditingName}
              handleProfileUploadComplete={handleProfileUploadComplete}
              handleProfileRemoveComplete={handleProfileRemoveComplete}
              handleOpenAddMember={handleOpenAddMember}
              setDirection={setDirection}
              setCurrentViewState={setCurrentViewState}
              isEditingDesc={isEditingDesc}
              editedDesc={editedDesc}
              setEditedDesc={setEditedDesc}
              handleSaveDesc={handleSaveDesc}
              startEditingDesc={startEditingDesc}
              setIsEditingDesc={setIsEditingDesc}
              mediaItems={mediaItems}
              contactInfoData={contactInfoData}
              contactInfoLoading={contactInfoLoading}
              groupInfoLoading={groupInfoLoading}
              isRemovedFromCurrentGroup={isRemovedFromCurrentGroup}
              auth={auth}
              setIsParticipantSearchOpen={setIsParticipantSearchOpen}
              handleMemberClick={handleMemberClick}
              showAllMembers={showAllMembers}
              setShowAllMembers={setShowAllMembers}
              isFavorite={!!isFavorite}
              handleToggleFavorite={handleToggleFavorite}
              isMuted={isMuted}
              onToggleMute={handleToggleMute}
              handleClearChatClick={handleClearChatClick}
              handleDeleteChatClick={handleDeleteChatClick}
              handleExitGroupClick={handleExitGroupClick}
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              pagination={pagination}
              loadMoreMedia={loadMoreMedia}
              loadMoreDocuments={loadMoreDocuments}
              handleMediaClick={handleMediaClick}
              handleDownload={handleDownloadFile}
              enablePagination={enablePagination}
              messages={messages}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              scrollToMessage={scrollToMessage}
              groupPermissions={groupPermissions}
              handlePermissionChange={handlePermissionChange}
              onEditAdmins={() => setIsEditAdminDialogOpen(true)}
              onPastParticipantsClick={() => setIsPastParticipantsOpen(true)}
              messageInfo={messageInfo}
              onClose={onClose}
              searchResults={searchResults}
              isSearching={isSearching}
              onSearchMessages={onSearchMessages}
              onSearchByDate={onSearchByDate}
              containerRef={containerRef}
              hasConversation={hasConversation}
            />
          </div>
        </div>

        <GroupDialogs
          isAddMemberDialogOpen={isAddMemberDialogOpen}
          setIsAddMemberDialogOpen={setIsAddMemberDialogOpen}
          handleAddMembersSubmit={handleAddMembersSubmit}
          localGroupData={localGroupData}
          isParticipantSearchOpen={isParticipantSearchOpen}
          setIsParticipantSearchOpen={setIsParticipantSearchOpen}
          handleMemberClick={handleMemberClick}
          isEditAdminDialogOpen={isEditAdminDialogOpen}
          setIsEditAdminDialogOpen={setIsEditAdminDialogOpen}
          handleEditAdminsSubmit={handleEditAdminsSubmit}
        />

        <AddMemberDialog
          open={isPastParticipantsOpen}
          onClose={() => setIsPastParticipantsOpen(false)}
          mode="viewPastParticipants"
          conversationId={conversationId}
        />

        <MemberActions
          memberMenuAnchorEl={memberMenuAnchorEl}
          menuPosition={menuPosition}
          onCloseMenu={() => {
            setMemberMenuAnchorEl(null);
            setMenuPosition(null);
          }}
          confirmationModal={confirmationModal}
          isCurrentUserAdmin={isCurrentUserAdmin as boolean | undefined}
          localGroupData={localGroupData as any}
          onMenuAction={handleMenuAction}
          onConfirmAction={handleConfirmMemberAction}
          onCloseConfirmation={() =>
            setConfirmationModal({ isOpen: false, member: null, actionType: null })
          }
        />

        <ConfirmationDialog
          isOpen={confirmationModal.isOpen && !confirmationModal.member}
          onClose={() =>
            setConfirmationModal({ isOpen: false, member: null, actionType: null })
          }
          onConfirm={handleConfirmMemberAction}
          title={
            confirmationModal.actionType === "clearChat"
              ? "Clear Chat?"
              : confirmationModal.actionType === "deleteGroup"
                ? "Delete Group?"
                : confirmationModal.actionType === "deleteChat"
                  ? "Delete Chat?"
                  : confirmationModal.actionType === "adminCannotLeave"
                    ? "Cannot Leave Group"
                    : confirmationModal.actionType === "exitGroup"
                      ? "Exit Group?"
                      : "Confirm Action"
          }
          description={
            confirmationModal.actionType === "clearChat"
              ? "Are you sure you want to clear all messages in this chat?"
              : confirmationModal.actionType === "deleteGroup"
                ? "Are you sure you want to delete this group conversation? This will remove the conversation from your chat list."
                : confirmationModal.actionType === "deleteChat"
                  ? `Are you sure you want to delete the chat with ${displayName}?`
                  : confirmationModal.actionType === "adminCannotLeave"
                    ? "You cannot leave the group because you are the only administrator. Please assign another admin before leaving."
                    : confirmationModal.actionType === "exitGroup"
                      ? "Are you sure you want to exit this group?"
                      : "Are you sure you want to proceed?"
          }
          confirmText={
            confirmationModal.actionType === "clearChat"
              ? "Clear"
              : confirmationModal.actionType === "deleteGroup" ||
                  confirmationModal.actionType === "deleteChat"
                ? "Delete"
                : confirmationModal.actionType === "adminCannotLeave"
                  ? "OK"
                  : confirmationModal.actionType === "exitGroup"
                    ? "Exit"
                    : "Confirm"
          }
          variant={
            ["clearChat", "deleteGroup", "deleteChat", "exitGroup"].includes(
              confirmationModal.actionType || ""
            )
              ? "danger"
              : "primary"
          }
          showCancel={confirmationModal.actionType !== "adminCannotLeave"}
        />

        <MediaViewer
          open={mediaOpen}
          items={mediaViewerItems}
          initialIndex={initialMediaIndex}
          onClose={() => setMediaOpen(false)}
        />
      </div>
    </>
  );
};

export default CustomerDetails;
