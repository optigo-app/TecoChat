"use client";

import { memo, useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
} from "@mui/material";

interface ConfirmationDialogProps {
  open: boolean;
  title: string;
  description: string;
  defaultFileName?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: (fileName: string) => void;
  onCancel: () => void;
}

const ConfirmationDialogComponent = ({
  open,
  title,
  description,
  defaultFileName = "",
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
}: ConfirmationDialogProps) => {
  const [fileName, setFileName] = useState(defaultFileName);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) {
      setFileName(defaultFileName);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open, defaultFileName]);

  const handleConfirm = () => {
    onConfirm(fileName.trim() || defaultFileName);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleConfirm();
    }
  };

  return (
    <Dialog open={open} onClose={onCancel} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontSize: "1rem", fontWeight: 600 }}>{title}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {description}
        </Typography>
        <TextField
          inputRef={inputRef}
          fullWidth
          size="small"
          value={fileName}
          onChange={(e) => setFileName(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="filename.txt"
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onCancel} color="inherit" size="small">
          {cancelLabel}
        </Button>
        <Button onClick={handleConfirm} variant="contained" size="small">
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default memo(ConfirmationDialogComponent);
