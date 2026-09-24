"use client";

import { Box, Typography, IconButton } from "@mui/material";
import { MessageCircle } from "lucide-react";
import { useIsMobile } from "../../hooks/useIsMobile";
import ProfileSection from "./ProfileSection";
import ActionButtons from "./ActionButtons";
import GroupDescription from "./GroupDescription";
import MediaPreview from "./MediaPreview";
import GroupMembersSection from "./GroupMembersSection";
import SettingsSection from "./SettingsSection";
import DangerZone from "./DangerZone";
import MediaPanelView from "./MediaPanelView";
import SearchMessages from "./SearchMessages";
import GroupPermissions from "./GroupPermissions";
import MessageInfo from "./MessageInfo";
import ContactInfo from "./ContactInfo";
import CommonGroupsSection from "./CommonGroupsSection";

interface MediaItem {
  [key: string]: unknown;
}

interface MediaItems {
  images?: MediaItem[];
  videos?: MediaItem[];
  documents?: MediaItem[];
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

interface LocalGroupData {
  members: any[];
  description?: string;
  name?: string;
  createdBy?: string;
  entryDate?: string;
  createdById?: string | number | null;
  isPastParticipant?: number;
  [key: string]: unknown;
}

interface DetailsViewsProps {
  currentViewState: string;
  direction: string;
  customer: any;
  isCurrentUserAdmin: boolean | undefined;
  avatarSeed: string;
  localGroupData: LocalGroupData;
  displayName: string;
  isEditingName: boolean;
  setIsEditingName: (open: boolean) => void;
  editedName: string;
  setEditedName: (value: string) => void;
  handleSaveName: () => void;
  startEditingName: () => void;
  handleProfileUploadComplete: (imageUrl: string, file: File) => void | Promise<void>;
  handleProfileRemoveComplete: () => void;
  handleOpenAddMember: () => void;
  setDirection: (dir: string) => void;
  setCurrentViewState: (view: string) => void;
  isEditingDesc: boolean;
  editedDesc: string;
  setEditedDesc: (value: string) => void;
  handleSaveDesc: () => void;
  startEditingDesc: () => void;
  setIsEditingDesc: (open: boolean) => void;
  mediaItems: MediaItems;
  contactInfoData: any;
  contactInfoLoading: boolean;
  groupInfoLoading: boolean;
  isRemovedFromCurrentGroup: boolean;
  auth: any;
  setIsParticipantSearchOpen: (open: boolean) => void;
  handleMemberClick: (event: React.MouseEvent, member: any) => void;
  showAllMembers: boolean;
  setShowAllMembers: (show: boolean) => void;
  isFavorite: boolean;
  handleToggleFavorite: () => void;
  isMuted?: boolean;
  onToggleMute?: () => void;
  handleClearChatClick: () => void;
  handleDeleteChatClick: () => void;
  handleExitGroupClick: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  pagination: Pagination;
  loadMoreMedia: (() => void) | null;
  loadMoreDocuments: (() => void) | null;
  handleMediaClick: (media: MediaItem) => void;
  handleDownload: (url: string, name: string) => void;
  enablePagination: boolean;
  messages: any;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  scrollToMessage?: (messageId: string | number, containerRef: React.RefObject<any>, attachmentId?: string | null, searchQuery?: string | null) => void;
  groupPermissions: GroupPermissionsData;
  handlePermissionChange: (name: string, value: boolean) => void;
  onEditAdmins: () => void;
  onPastParticipantsClick: () => void;
  messageInfo: any;
  onClose: () => void;
  searchResults?: any[];
  isSearching?: boolean;
  onSearchMessages?: (query: string) => void;
  onSearchByDate?: (date: string) => void;
  containerRef?: React.RefObject<any>;
  open: boolean;
  /** Whether an existing conversation exists. When false (new-chat contact),
   *  conversation-dependent sections are hidden. */
  hasConversation?: boolean;
  /** Start a new 1:1 chat — shown when there's no existing conversation. */
  onStartChat?: () => void;
}

const DetailsViews = ({
  currentViewState,
  direction,
  customer,
  isCurrentUserAdmin,
  avatarSeed,
  localGroupData,
  displayName,
  isEditingName,
  setIsEditingName,
  editedName,
  setEditedName,
  handleSaveName,
  startEditingName,
  handleProfileUploadComplete,
  handleProfileRemoveComplete,
  handleOpenAddMember,
  setDirection,
  setCurrentViewState,
  isEditingDesc,
  editedDesc,
  setEditedDesc,
  handleSaveDesc,
  startEditingDesc,
  setIsEditingDesc,
  mediaItems,
  contactInfoData,
  contactInfoLoading,
  groupInfoLoading,
  isRemovedFromCurrentGroup,
  auth,
  setIsParticipantSearchOpen,
  handleMemberClick,
  showAllMembers,
  setShowAllMembers,
  isFavorite,
  handleToggleFavorite,
  isMuted,
  onToggleMute,
  handleClearChatClick,
  handleDeleteChatClick,
  handleExitGroupClick,
  activeTab,
  setActiveTab,
  pagination,
  loadMoreMedia,
  loadMoreDocuments,
  handleMediaClick,
  handleDownload,
  enablePagination,
  messages,
  searchQuery,
  setSearchQuery,
  scrollToMessage,
  groupPermissions,
  handlePermissionChange,
  onEditAdmins,
  onPastParticipantsClick,
  messageInfo,
  onClose,
  searchResults = [],
  isSearching = false,
  onSearchMessages,
  onSearchByDate,
  containerRef,
  open,
  hasConversation = true,
  onStartChat,
}: DetailsViewsProps) => {
  const isMobile = useIsMobile();
  return (
    <div className={`views-container view-${currentViewState} direction-${direction}`}>
      {currentViewState === "info" ? (
        <div className={`view-content info-view ${direction}`} key="info">
          <div
            className="info-view-container"
            style={{ display: "flex", flexDirection: "column" }}
          >
            <div className="info-sections-wrapper" style={{ flex: 1 }}>
              <ProfileSection
                customer={customer}
                isCurrentUserAdmin={isCurrentUserAdmin}
                avatarSeed={avatarSeed}
                localGroupData={localGroupData}
                displayName={displayName}
                isEditingName={isEditingName}
                setIsEditingName={setIsEditingName}
                editedName={editedName}
                setEditedName={setEditedName}
                handleSaveName={handleSaveName}
                startEditingName={startEditingName}
                handleProfileUploadComplete={handleProfileUploadComplete}
                handleProfileRemoveComplete={handleProfileRemoveComplete}
                groupPermissions={groupPermissions}
                loading={groupInfoLoading}
              />

              {hasConversation && (
                <ActionButtons
                  customer={customer}
                  isCurrentUserAdmin={isCurrentUserAdmin}
                  onAddClick={handleOpenAddMember}
                  onSearchClick={() => {
                    setDirection("forward");
                    setCurrentViewState("search");
                  }}
                  groupPermissions={groupPermissions}
                />
              )}

              {/* No existing conversation (e.g. opened via @mention click) —
                  show a "Message" button to start a chat with this contact.
                  Reuses group-block-actions card styling so it renders as a
                  full-width action card like Add/Search. */}
              {!hasConversation && onStartChat && (
                <div
                  className="action-buttons group-block-actions"
                  style={{ marginBottom: 12 }}
                >
                  <div
                    className="action-block-item"
                    onClick={onStartChat}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onStartChat();
                      }
                    }}
                  >
                    <IconButton className="action-circle" tabIndex={-1}>
                      <MessageCircle size={20} />
                    </IconButton>
                    <span className="action-label">Message</span>
                  </div>
                </div>
              )}

              {customer?.IsGroup === 1 && (
                <>
                  <GroupDescription
                    localGroupData={localGroupData}
                    isCurrentUserAdmin={isCurrentUserAdmin}
                    isEditingDesc={isEditingDesc}
                    editedDesc={editedDesc}
                    setEditedDesc={setEditedDesc}
                    handleSaveDesc={handleSaveDesc}
                    startEditingDesc={startEditingDesc}
                    setIsEditingDesc={setIsEditingDesc}
                    groupPermissions={groupPermissions}
                  />
                </>
              )}

              <div
                className="section-divider"
                style={{ height: "1px", backgroundColor: "var(--color-wa-border-light)", margin: "0 -24px" }}
              />
              {customer?.IsGroup !== 1 && (
                <>
                  <ContactInfo
                    customer={customer}
                    contactInfo={contactInfoData}
                    loading={contactInfoLoading}
                  />
                  <div
                    className="section-divider"
                    style={{
                      height: "1px",
                      backgroundColor: "var(--color-wa-border-light)",
                      margin: "0 -24px",
                    }}
                  />
                </>
              )}
              {hasConversation && (
                <MediaPreview
                  mediaItems={mediaItems}
                  onClick={() => {
                    setDirection("forward");
                    setCurrentViewState("media");
                  }}
                  onMediaClick={handleMediaClick}
                />
              )}
              {customer?.IsGroup === 1 && isRemovedFromCurrentGroup && (
                <Box className="removed-from-group-message" sx={{ textAlign: "center", pb: 2 }}>
                  <Typography
                    style={{ color: "#856404", fontSize: "14px", fontWeight: 500 }}
                  >
                    You&apos;re no longer a member of this group
                  </Typography>
                </Box>
              )}
              {hasConversation && customer?.IsGroup !== 1 && (
                <>
                  <div
                    className="section-divider"
                    style={{
                      height: "1px",
                      backgroundColor: "var(--color-wa-border-light)",
                      margin: "0 -24px",
                    }}
                  />
                  <CommonGroupsSection customer={customer} auth={auth} open={open} />
                </>
              )}

              {customer?.IsGroup === 1 && hasConversation && (
                <>
                  <div
                    className="section-divider"
                    style={{
                      height: "1px",
                      backgroundColor: "var(--color-wa-border-light)",
                      margin: "0 -24px",
                    }}
                  />
                  <GroupMembersSection
                    members={localGroupData.members}
                    isCurrentUserAdmin={isCurrentUserAdmin}
                    auth={auth}
                    onAddMemberClick={handleOpenAddMember}
                    onSearchClick={() => setIsParticipantSearchOpen(true)}
                    onMemberClick={handleMemberClick}
                    showAllMembers={showAllMembers}
                    setShowAllMembers={setShowAllMembers}
                    groupPermissions={groupPermissions}
                    onPastParticipantsClick={onPastParticipantsClick}
                    isPastParticipant={localGroupData.isPastParticipant}
                    loading={groupInfoLoading}
                  />
                </>
              )}

              {hasConversation && (
                <>
                  <div
                    className="section-divider"
                    style={{ height: "1px", backgroundColor: "var(--color-wa-border-light)", margin: "0 -24px" }}
                  />

                  <SettingsSection
                    isFavorite={isFavorite}
                    onToggleFavorite={handleToggleFavorite}
                    isGroup={customer?.IsGroup === 1}
                    isCurrentUserAdmin={isCurrentUserAdmin}
                    isMuted={isMuted}
                    onToggleMute={onToggleMute}
                    onNavigateToPermissions={() => {
                      setDirection("forward");
                      setTimeout(() => setCurrentViewState("permissions"), 0);
                    }}
                  />
                </>
              )}
            </div>

            {hasConversation && (
              <div className="danger-zone-wrapper" style={{ marginTop: "auto" }}>
                <DangerZone
                  onClearChat={handleClearChatClick}
                  isGroup={customer?.IsGroup === 1}
                  onExitGroup={handleExitGroupClick}
                  isRemovedFromCurrentGroup={isRemovedFromCurrentGroup}
                  onDeleteChat={handleDeleteChatClick}
                />
              </div>
            )}
          </div>
        </div>
      ) : currentViewState === "media" ? (
        <div className={`view-content media-view ${direction}`} key="media">
          <MediaPanelView
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            mediaItems={mediaItems}
            pagination={pagination}
            onLoadMoreMedia={loadMoreMedia}
            onLoadMoreDocuments={loadMoreDocuments}
            onMediaClick={handleMediaClick}
            onDownload={handleDownload}
            enablePagination={enablePagination}
          />
        </div>
      ) : currentViewState === "search" ? (
        <div className={`view-content search-view ${direction}`} key="search">
          <SearchMessages
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            onResultClick={(msg) => {
              if (scrollToMessage && containerRef) {
                const msgId = msg.MessageId ?? msg.id;
                if (msgId !== undefined) {
                  scrollToMessage(msgId, containerRef, null, searchQuery || null);
                }
              }
              // On mobile, close the search panel (drawer) after clicking a
              // result so the user sees the scrolled-to message in the chat.
              if (isMobile) {
                onClose();
              }
            }}
            searchResults={searchResults}
            isSearching={isSearching}
            onSearchMessages={onSearchMessages}
            onSearchByDate={onSearchByDate}
          />
        </div>
      ) : currentViewState === "permissions" ? (
        <div className={`view-content permissions-view ${direction}`} key="permissions">
          <GroupPermissions
            permissions={groupPermissions}
            onPermissionChange={handlePermissionChange}
            groupMembers={localGroupData.members}
            onEditAdmins={onEditAdmins}
            onBack={() => {
              setDirection("backward");
              setCurrentViewState("info");
            }}
          />
        </div>
      ) : currentViewState === "messageInfo" ? (
        <div className={`view-content message-info-view ${direction}`} key="messageInfo">
          <MessageInfo
            messageInfo={messageInfo}
            localGroupData={localGroupData}
            auth={auth}
            selectedCustomer={customer}
            messages={messages}
          />
        </div>
      ) : null}
    </div>
  );
};

export default DetailsViews;
