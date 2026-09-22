"use client";

import { memo } from "react";
import { Menu, MenuItem, ListItemIcon, ListItemText } from "@mui/material";
import { X } from "lucide-react";

interface ChatAreaMenuProps {
  open: boolean;
  position: { mouseX: number; mouseY: number } | null;
  onClose: () => void;
  onCloseChat: () => void;
}

const glassMenuSx = {
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
} as const;

const ChatAreaMenuComponent = ({
  open,
  position,
  onClose,
  onCloseChat,
}: ChatAreaMenuProps) => {
  return (
    <Menu
      open={open}
      onClose={onClose}
      anchorReference="anchorPosition"
      anchorPosition={
        position
          ? { top: position.mouseY, left: position.mouseX }
          : undefined
      }
      transitionDuration={0}
      slotProps={{ paper: { sx: glassMenuSx } }}
    >
      <MenuItem onClick={onCloseChat}>
        <ListItemIcon><X size={18} /></ListItemIcon>
        <ListItemText primary="Close chat" />
      </MenuItem>
    </Menu>
  );
};

export const ChatAreaMenu = memo(ChatAreaMenuComponent);
export default ChatAreaMenu;
