"use client";

import { memo, useState, useRef } from "react";
import { IconButton, Popper, Paper, ClickAwayListener, useTheme, alpha } from "@mui/material";
import { SmilePlus } from "lucide-react";
import EmojiPicker, { EmojiStyle, Theme as EmojiTheme } from "emoji-picker-react";

interface QuickReactionMenuProps {
  onEmojiSelect?: (emoji: string) => void;
  onSelectEmoji?: (emoji: string) => void;
  open?: boolean;
  anchorEl?: HTMLElement | null;
  hideTrigger?: boolean;
  disablePortal?: boolean;
  onOpen?: (e: HTMLElement) => void;
  onClose?: () => void;
  size?: number;
}

const QuickReactionMenuComponent = ({
  onEmojiSelect,
  onSelectEmoji,
  open: controlledOpen,
  anchorEl: controlledAnchorEl,
  hideTrigger = false,
  disablePortal = false,
  onOpen,
  onClose,
  size = 18,
}: QuickReactionMenuProps) => {
  const theme = useTheme();
  const [internalOpen, setInternalOpen] = useState(false);
  const internalAnchorRef = useRef<HTMLButtonElement | null>(null);

  // Controlled vs uncontrolled
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const anchorEl = isControlled ? controlledAnchorEl : internalAnchorRef.current;

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isControlled) {
      onOpen?.(e.currentTarget as HTMLElement);
    } else {
      setInternalOpen((v) => !v);
    }
  };

  const handleClose = () => {
    if (isControlled) {
      onClose?.();
    } else {
      setInternalOpen(false);
    }
  };

  const handleEmojiClick = (emojiData: { emoji: string }) => {
    onSelectEmoji?.(emojiData.emoji);
    onEmojiSelect?.(emojiData.emoji);
    handleClose();
  };

  return (
    <>
      {!hideTrigger && (
        <IconButton
          ref={internalAnchorRef}
          size="small"
          onClick={handleToggle}
          sx={{
            color: theme.palette.text.secondary,
            padding: "4px",
            transition: "all 0.2s ease",
            "&:hover": {
              color: theme.palette.primary.main,
              backgroundColor: alpha(theme.palette.primary.main, 0.08),
            },
          }}
        >
          <SmilePlus size={size} />
        </IconButton>
      )}
      <Popper
        open={open}
        anchorEl={anchorEl || internalAnchorRef.current}
        placement="top"
        disablePortal={disablePortal}
        sx={{ zIndex: 11030 }}
      >
        <ClickAwayListener onClickAway={handleClose}>
          <Paper
            elevation={0}
            sx={{
              borderRadius: 3,
              overflow: "hidden",
              bgcolor: (t) =>
                t.palette.mode === "dark"
                  ? "rgba(35, 35, 51, 0.92)"
                  : "rgba(255, 255, 255, 0.92)",
              backdropFilter: "blur(20px) saturate(180%)",
              WebkitBackdropFilter: "blur(20px) saturate(180%)",
              boxShadow: "0px 10px 30px rgba(0,0,0,0.2)",
              border: (t) =>
                t.palette.mode === "dark"
                  ? "1px solid rgba(255,255,255,0.08)"
                  : "1px solid rgba(255,255,255,0.5)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <EmojiPicker
              onEmojiClick={handleEmojiClick}
              width={300}
              height={350}
              searchDisabled={false}
              skinTonesDisabled={true}
              previewConfig={{ showPreview: false }}
              emojiStyle={EmojiStyle.APPLE}
              theme={theme.palette.mode === "dark" ? EmojiTheme.DARK : EmojiTheme.LIGHT}
            />
          </Paper>
        </ClickAwayListener>
      </Popper>
    </>
  );
};

export default memo(QuickReactionMenuComponent);
