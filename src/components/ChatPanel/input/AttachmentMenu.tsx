"use client";

import { memo } from "react";
import { Menu, MenuItem, ListItemIcon, ListItemText, Typography } from "@mui/material";
import { Image, Video, FileText } from "lucide-react";

interface AttachmentMenuProps {
  anchorEl: HTMLElement | null;
  open: boolean;
  onClose: () => void;
  onFilePick: (e: React.MouseEvent, params: { accept: string; type: string }) => void;
}

const AttachmentMenuComponent = ({
  anchorEl,
  open,
  onClose,
  onFilePick,
}: AttachmentMenuProps) => {
  return (
    <Menu
      anchorEl={anchorEl}
      open={open}
      onClose={onClose}
      onClick={(e) => e.stopPropagation()}
      sx={{ zIndex: (theme) => theme.zIndex.modal + 20 }}
      slotProps={{
        paper: {
          elevation: 0,
          sx: {
            minWidth: 200,
            borderRadius: 2.5,
            py: 1,
            mb: 1.5,
            // Glassmorphic surface
            bgcolor: (t: { palette: { mode: string } }) =>
              t.palette.mode === "dark"
                ? "rgba(35, 35, 51, 0.82)"
                : "rgba(255, 255, 255, 0.82)",
            backdropFilter: "blur(20px) saturate(180%)",
            WebkitBackdropFilter: "blur(20px) saturate(180%)",
            boxShadow: "0px 10px 25px rgba(0,0,0,0.12), 0px 4px 10px rgba(0,0,0,0.08)",
            border: (t: { palette: { mode: string } }) =>
              t.palette.mode === "dark"
                ? "1px solid rgba(255,255,255,0.08)"
                : "1px solid rgba(255,255,255,0.5)",
          },
        },
      }}
      transformOrigin={{ horizontal: "left", vertical: "bottom" }}
      anchorOrigin={{ horizontal: "left", vertical: "top" }}
    >
      <MenuItem
        onClick={(e) => onFilePick(e, { accept: "image/*", type: "image" })}
        sx={{ py: 1.2, px: 2.5, mx: 0.8, borderRadius: 1.5 }}
      >
        <ListItemIcon sx={{ minWidth: "38px", color: "#0046FF" }}>
          <Image size={18} />
        </ListItemIcon>
        <ListItemText>
          <Typography variant="body2" sx={{ fontWeight: 500 }}>Photo</Typography>
        </ListItemText>
      </MenuItem>

      <MenuItem
        onClick={(e) => onFilePick(e, { accept: "video/*", type: "video" })}
        sx={{ py: 1.2, px: 2.5, mx: 0.8, borderRadius: 1.5 }}
      >
        <ListItemIcon sx={{ minWidth: "38px", color: "#FF8040" }}>
          <Video size={18} />
        </ListItemIcon>
        <ListItemText>
          <Typography variant="body2" sx={{ fontWeight: 500 }}>Video</Typography>
        </ListItemText>
      </MenuItem>

      <MenuItem
        onClick={(e) =>
          onFilePick(e, {
            // Documents only — no image/video/audio (those have own pickers)
            accept:
              ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.rtf,.odt,.ods,.odp,.epub,.zip,.rar,.7z,.json,.xml,.html,.htm,.md,.log,.sql,.apk",
            type: "document",
          })
        }
        sx={{ py: 1.2, px: 2.5, mx: 0.8, borderRadius: 1.5 }}
      >
        <ListItemIcon sx={{ minWidth: "38px", color: "#9929EA" }}>
          <FileText size={18} />
        </ListItemIcon>
        <ListItemText>
          <Typography variant="body2" sx={{ fontWeight: 500 }}>Document</Typography>
        </ListItemText>
      </MenuItem>
    </Menu>
  );
};

export default memo(AttachmentMenuComponent);
