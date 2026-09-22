"use client";

import { memo } from "react";
import { Menu, MenuItem, ListItemIcon, ListItemText, Divider } from "@mui/material";
import {
  Calendar,
  Star,
  Info,
  CheckSquare,
  BellOff,
  Bell,
  X,
  CircleMinus,
  LogOut,
  Trash2,
} from "lucide-react";

interface HeaderMenuProps {
  anchorEl: HTMLElement | null;
  open: boolean;
  onClose: () => void;
  isMobile: boolean;
  isGroup: boolean;
  isFavorite: boolean;
  isCurrentlyMuted: boolean;
  isRemovedFromCurrentGroup: boolean;
  starFilter: boolean;
  onMenuAction: (action: string) => void;
  onOpenDatePicker: () => void;
  onToggleStarFilter?: () => void;
}

const glassMenuSx = {
  borderRadius: "16px",
  minWidth: "200px",
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
} as const;

const HeaderMenuComponent = ({
  anchorEl,
  open,
  onClose,
  isMobile,
  isGroup,
  isFavorite,
  isCurrentlyMuted,
  isRemovedFromCurrentGroup,
  starFilter,
  onMenuAction,
  onOpenDatePicker,
  onToggleStarFilter,
}: HeaderMenuProps) => {
  return (
    <Menu
      anchorEl={anchorEl}
      open={open}
      onClose={onClose}
      transitionDuration={0}
      slotProps={{ paper: { sx: glassMenuSx } }}
      anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      transformOrigin={{ vertical: "top", horizontal: "right" }}
    >
      {/* Mobile-only actions relocated from the header to keep it compact */}
      {isMobile && (
        <MenuItem onClick={onOpenDatePicker}>
          <ListItemIcon><Calendar size={18} /></ListItemIcon>
          <ListItemText primary="Jump to date" />
        </MenuItem>
      )}
      {isMobile && onToggleStarFilter && (
        <MenuItem
          onClick={() => {
            onClose();
            onToggleStarFilter();
          }}
        >
          <ListItemIcon>
            <Star
              size={18}
              fill={starFilter ? "#FFD700" : "none"}
              color={starFilter ? "#FFD700" : "currentColor"}
            />
          </ListItemIcon>
          <ListItemText primary={starFilter ? "Show all messages" : "Show starred only"} />
        </MenuItem>
      )}
      {isMobile && <Divider sx={{ my: 0.5 }} />}
      <MenuItem onClick={() => onMenuAction("groupInfo")}>
        <ListItemIcon><Info size={18} /></ListItemIcon>
        <ListItemText primary={isGroup ? "Group Info" : "Contact Info"} />
      </MenuItem>
      <MenuItem onClick={() => onMenuAction("selectMessages")}>
        <ListItemIcon><CheckSquare size={18} /></ListItemIcon>
        <ListItemText primary="Select messages" />
      </MenuItem>
      <MenuItem onClick={() => onMenuAction("mute")}>
        <ListItemIcon>{isCurrentlyMuted ? <Bell size={18} /> : <BellOff size={18} />}</ListItemIcon>
        <ListItemText primary={isCurrentlyMuted ? "Unmute notification" : "Mute notification"} />
      </MenuItem>
      <MenuItem onClick={() => onMenuAction("favourite")}>
        <ListItemIcon>
          <Star
            size={18}
            fill={isFavorite ? "#FFD700" : "none"}
            color={isFavorite ? "#FFD700" : "currentColor"}
          />
        </ListItemIcon>
        <ListItemText primary={isFavorite ? "Remove from favourite" : "Add to favourite"} />
      </MenuItem>
      <MenuItem onClick={() => onMenuAction("close")}>
        <ListItemIcon><X size={18} /></ListItemIcon>
        <ListItemText primary="Close chat" />
      </MenuItem>
      <Divider sx={{ my: 0.5 }} />
      <MenuItem onClick={() => onMenuAction("clearChat")}>
        <ListItemIcon><CircleMinus size={18} /></ListItemIcon>
        <ListItemText primary="Clear chat" />
      </MenuItem>
      {isGroup ? (
        isRemovedFromCurrentGroup ? (
          <MenuItem onClick={() => onMenuAction("deleteGroup")} sx={{ color: "error.main" }}>
            <ListItemIcon sx={{ color: "error.main" }}><Trash2 size={18} /></ListItemIcon>
            <ListItemText primary="Delete group" />
          </MenuItem>
        ) : (
          <MenuItem onClick={() => onMenuAction("exitGroup")} sx={{ color: "error.main" }}>
            <ListItemIcon sx={{ color: "error.main" }}><LogOut size={18} /></ListItemIcon>
            <ListItemText primary="Exit group" />
          </MenuItem>
        )
      ) : (
        <MenuItem onClick={() => onMenuAction("deleteChat")} sx={{ color: "error.main" }}>
          <ListItemIcon sx={{ color: "error.main" }}><Trash2 size={18} /></ListItemIcon>
          <ListItemText primary="Delete chat" />
        </MenuItem>
      )}
    </Menu>
  );
};

export const HeaderMenu = memo(HeaderMenuComponent);
export default HeaderMenu;
