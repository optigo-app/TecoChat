"use client";

// Ported from OldChatReactCode/src/components/DragDropOverlay/DragDropOverlay.js
// Full-screen overlay shown when dragging files over the message area.

import { Box, Typography } from "@mui/material";
import { CloudUpload } from "lucide-react";
import "./DragDropOverlay.scss";

interface DragDropOverlayProps {
  isDragging: boolean;
}

const DragDropOverlay = ({ isDragging }: DragDropOverlayProps) => {
  return (
    <Box className={`drag-drop-overlay ${isDragging ? "visible" : ""}`}>
      <Box className="overlay-content">
        <CloudUpload className="upload-icon" size={50} />
        <Typography variant="h5" className="overlay-text">
          Drop files here to upload
        </Typography>
      </Box>
    </Box>
  );
};

export default DragDropOverlay;
