"use client";

import { memo } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  useTheme,
  alpha,
} from "@mui/material";
import type { MediaFileItem } from "./CoreLogic/uiReducer";

interface ReplaceAddMediaDialogProps {
  open: boolean;
  newFiles: any[] | null;
  existingCount: number;
  onClose: () => void;
  onReplace: (files: File[]) => void;
  onAdd: (files: File[]) => void;
}

const ReplaceAddMediaDialogComponent = ({
  open,
  newFiles,
  existingCount,
  onClose,
  onReplace,
  onAdd,
}: ReplaceAddMediaDialogProps) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            borderRadius: 3,
            p: 1,
            bgcolor: theme.palette.background.paper,
            backgroundImage: "none",
            boxShadow: isDark ? "0 20px 60px rgba(0,0,0,0.6)" : "0 20px 60px rgba(0,0,0,0.2)",
            border: isDark ? `1px solid ${alpha(theme.palette.primary.main, 0.15)}` : "none",
          },
        },
        backdrop: {
          sx: {
            bgcolor: isDark ? "rgba(10,10,20,0.7)" : "rgba(0,0,0,0.5)",
          },
        },
      }}
    >
      <DialogTitle sx={{ fontWeight: 700, fontSize: "1.1rem", color: theme.palette.text.primary, pb: 1 }}>
        Replace or Add Files?
      </DialogTitle>
      <DialogContent sx={{ pb: 1 }}>
        <Typography variant="body2" sx={{ lineHeight: 1.6, color: theme.palette.text.secondary }}>
          You already have <strong style={{ color: theme.palette.primary.main }}>{existingCount}</strong> file{existingCount !== 1 ? "s" : ""} in the preview.
          Do you want to replace them with the new file{newFiles?.length !== 1 ? "s" : ""}, or add to the existing ones?
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 2.5, pb: 2.5, pt: 1, gap: 1, justifyContent: "flex-end" }}>
        <Button
          onClick={onClose}
          variant="text"
          sx={{
            borderRadius: 2,
            textTransform: "none",
            fontWeight: 600,
            px: 2,
            py: 0.75,
            color: theme.palette.text.secondary,
            "&:hover": { bgcolor: alpha(theme.palette.text.primary, isDark ? 0.12 : 0.06) },
            "&:focus-visible": { outline: `2px solid ${alpha(theme.palette.primary.main, 0.5)}`, outlineOffset: 2 },
          }}
        >
          Cancel
        </Button>
        <Button
          onClick={() => {
            if (newFiles) {
              const fileObjects = newFiles.map((m: any) => m.file).filter(Boolean);
              if (fileObjects.length) onReplace(fileObjects);
            }
            onClose();
          }}
          variant="outlined"
          sx={{
            borderRadius: 2,
            textTransform: "none",
            fontWeight: 600,
            px: 2,
            py: 0.75,
            borderColor: alpha(theme.palette.primary.main, isDark ? 0.6 : 0.5),
            color: theme.palette.primary.main,
            "&:hover": {
              borderColor: theme.palette.primary.main,
              bgcolor: alpha(theme.palette.primary.main, isDark ? 0.12 : 0.06),
            },
            "&:focus-visible": { outline: `2px solid ${alpha(theme.palette.primary.main, 0.5)}`, outlineOffset: 2 },
          }}
        >
          Replace
        </Button>
        <Button
          onClick={() => {
            if (newFiles) {
              const fileObjects = newFiles.map((m: any) => m.file).filter(Boolean);
              if (fileObjects.length) onAdd(fileObjects);
            }
            onClose();
          }}
          variant="contained"
          disableElevation
          sx={{
            borderRadius: 2,
            textTransform: "none",
            fontWeight: 700,
            px: 2,
            py: 0.75,
            bgcolor: theme.palette.primary.main,
            color: "#ffffff !important",
            "&:hover": {
              bgcolor: theme.palette.primary.dark,
            },
            "&:focus-visible": { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: 2 },
            "& .MuiButton-label": {
              color: "#ffffff !important",
            },
          }}
        >
          Add
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export const ReplaceAddMediaDialog = memo(ReplaceAddMediaDialogComponent);
export default ReplaceAddMediaDialog;
