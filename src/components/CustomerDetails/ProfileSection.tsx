"use client";

import {
  Typography,
  IconButton,
  Box,
  TextField,
  InputAdornment,
  Badge,
  Skeleton,
  styled,
} from "@mui/material";
import { Pencil, X, Check } from "lucide-react";
import { useState } from "react";
import ProfileAvatarUpload from "../ReusableComponent/ProfileAvatarUpload";
import ViewPhotoDialog from "../ReusableComponent/ViewPhotoDialog";
import { ConversationAvatar } from "../ConversationAvatar/ConversationAvatar";
import { isImageDead } from "../../utils/globalFunc";
import { renderEmojiText } from "../../utils/messageTextRenderer";
import { useIsMobile } from "../../hooks/useIsMobile";

const StyledBadge = styled(Badge)(() => ({
  "& .MuiBadge-badge": {
    backgroundColor: "#44b700",
    color: "#44b700",
    boxShadow: `0 0 0 2px var(--color-surface)`,
    width: 18,
    height: 18,
    borderRadius: "50%",
    "&::after": {
      position: "absolute",
      top: 0,
      left: 0,
      width: "100%",
      height: "100%",
      borderRadius: "50%",
      animation: "ripple 1.2s infinite ease-in-out",
      border: "1px solid currentColor",
      content: '""',
    },
  },
  "@keyframes ripple": {
    "0%": {
      transform: "scale(.8)",
      opacity: 1,
    },
    "100%": {
      transform: "scale(2.4)",
      opacity: 0,
    },
  },
}));

interface GroupPermissionsData {
  editGroupSettings?: boolean;
  [key: string]: boolean | undefined;
}

interface LocalGroupData {
  name?: string;
  members?: any[];
  [key: string]: unknown;
}

interface ProfileSectionProps {
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
  groupPermissions?: GroupPermissionsData;
  loading?: boolean;
}

const ProfileSection = ({
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
  groupPermissions,
  loading = false,
}: ProfileSectionProps) => {
  const [viewPhotoDialog, setViewPhotoDialog] = useState({ open: false, imageUrl: "" });
  const isMobile = useIsMobile();
  const canEditGroup = isCurrentUserAdmin || groupPermissions?.editGroupSettings;
  // Responsive avatar: smaller on mobile, full size on desktop
  const avatarSize = isMobile ? 96 : 130;

  const handleAvatarDoubleClick = () => {
    const imageUrl = customer?.ProfileImageUrl;
    if (imageUrl && !isImageDead(imageUrl)) {
      setViewPhotoDialog({ open: true, imageUrl });
    }
  };

  if (loading) {
    return (
      <div className="profile-section">
        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1.5, py: 3 }}>
          <Skeleton variant="circular" width={100} height={100} />
          <Skeleton variant="text" width={180} height={32} />
          <Skeleton variant="text" width={120} height={20} />
        </Box>
      </div>
    );
  }

  return (
    <div className={`profile-section ${customer?.IsGroup === 1 ? "group-profile" : ""}`}>
      {customer?.IsGroup === 1 && canEditGroup ? (
        <StyledBadge
          overlap="circular"
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
          variant="dot"
          invisible={customer?.IsGroup === 1}
        >
          <div onDoubleClick={handleAvatarDoubleClick} style={{ cursor: "zoom-in" }}>
            <ProfileAvatarUpload
              size={avatarSize}
              currentImageUrl={customer?.ProfileImageUrl}
              avatarSeed={avatarSeed}
              showOverlay={true}
              overlayText={
                customer?.ProfileImageUrl ? "Change group\nicon" : "Add group\nicon"
              }
              onUploadComplete={handleProfileUploadComplete}
              onRemoveComplete={handleProfileRemoveComplete}
              className="group-avatar-container"
              folderName="tecochat/profileImage"
            />
          </div>
        </StyledBadge>
      ) : (
        <div
          className={`avatar-container ${customer?.IsGroup === 1 ? "group-avatar-container" : ""}`}
          onDoubleClick={handleAvatarDoubleClick}
          style={{
            cursor:
              customer?.ProfileImageUrl && !isImageDead(customer?.ProfileImageUrl)
                ? "zoom-in"
                : "default",
          }}
        >
          <StyledBadge
            overlap="circular"
            anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
            variant="dot"
            invisible={customer?.IsGroup === 1}
          >
            <ConversationAvatar
              member={customer}
              size={avatarSize}
            />
          </StyledBadge>
        </div>
      )}

      <div className="name-row">
        {isEditingName ? (
          <Box sx={{ display: "flex", alignItems: "center", width: "100%", px: 2 }}>
            <TextField
              fullWidth
              variant="standard"
              value={editedName || ""}
              onChange={(e) => setEditedName(e.target.value.slice(0, 50))}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveName();
                if (e.key === "Escape") {
                  setEditedName(
                    customer?.IsGroup === 1 ? localGroupData?.name || "" : displayName || ""
                  );
                  setIsEditingName(false);
                }
              }}
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <Typography variant="caption" sx={{ color: "var(--color-text-secondary)", mr: 1 }}>
                        {(editedName || "").length}/50
                      </Typography>
                      <IconButton
                        size="small"
                        onClick={() => {
                          setEditedName(
                            customer?.IsGroup === 1
                              ? localGroupData?.name || ""
                              : displayName || ""
                          );
                          setIsEditingName(false);
                        }}
                        sx={{ color: "var(--color-text-secondary)", mr: 0.5 }}
                      >
                        <X size={18} />
                      </IconButton>
                      <IconButton size="small" onClick={handleSaveName} sx={{ color: "primary.main" }}>
                        <Check size={20} />
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
            />
          </Box>
        ) : (
          <>
            <Typography className="customer-name">
              {renderEmojiText(customer?.IsGroup === 1 ? localGroupData.name : displayName)}
            </Typography>
            {customer?.IsGroup === 1 && canEditGroup && (
              <IconButton size="small" className="edit-icon-btn" onClick={startEditingName}>
                <Pencil size={20} />
              </IconButton>
            )}
          </>
        )}
      </div>

      {customer?.IsGroup == 1 ? (
        <Typography className="group-subtext">
          Group · <span className="accent-text">{localGroupData.members?.length || 0} members</span>
        </Typography>
      ) : (
        <Typography className="customer-phone">
          {(customer?.Designation || customer?.UserId) || ""}
        </Typography>
      )}

      <ViewPhotoDialog
        open={viewPhotoDialog.open}
        onClose={() => setViewPhotoDialog({ open: false, imageUrl: "" })}
        imageUrl={viewPhotoDialog.imageUrl}
        title="View Profile Photo"
      />
    </div>
  );
};

export default ProfileSection;
