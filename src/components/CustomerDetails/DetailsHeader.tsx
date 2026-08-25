"use client";

import { Typography, IconButton } from "@mui/material";
import { X, ArrowLeft } from "lucide-react";

interface DetailsHeaderProps {
  currentViewState: string;
  initialViewState: string;
  onClose: () => void;
  onBack: () => void;
  isGroup: boolean;
}

const DetailsHeader = ({
  currentViewState,
  initialViewState,
  onClose,
  onBack,
  isGroup,
}: DetailsHeaderProps) => {
  const getHeaderTitle = () => {
    switch (currentViewState) {
      case "media":
        return "Media, docs and video";
      case "search":
        return "Search messages";
      case "permissions":
        return "Group permissions";
      case "messageInfo":
        return "Message info";
      default:
        return isGroup ? "Group info" : "Contact info";
    }
  };

  const isBackIcon =
    !["info", "messageInfo"].includes(currentViewState) &&
    !(currentViewState === "search" && initialViewState === "search");

  return (
    <div className="header-section">
      <IconButton
        className={["info", "messageInfo"].includes(currentViewState) ? "close-button" : "back-button"}
        onClick={isBackIcon ? onBack : onClose}
        size="small"
      >
        {isBackIcon ? <ArrowLeft size={20} /> : <X size={20} />}
      </IconButton>
      <Typography className="header-title">{getHeaderTitle()}</Typography>
    </div>
  );
};

export default DetailsHeader;
