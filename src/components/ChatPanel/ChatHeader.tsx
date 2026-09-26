"use client";

import { memo } from "react";
import { Typography, IconButton, Tooltip, Box } from "@mui/material";
import { RefreshCw, Search, EllipsisVertical, Star, ArrowLeft, Calendar, WifiOff } from "lucide-react";
import { ConversationAvatar } from "../ConversationAvatar/ConversationAvatar";
import { getCustomerDisplayName } from "../../utils/globalFunc";
import { useIsMobile } from "../../hooks/useIsMobile";
import type { ConversationListEntry } from "../../types/conversation";

interface ChatHeaderProps {
  selectedCustomer: ConversationListEntry | null;
  loading: boolean;
  onRefresh: () => void;
  onSearch: () => void;
  onMore: (e: React.MouseEvent<HTMLElement>) => void;
  onOpenInfo: () => void;
  onBack?: () => void;
  starFilter?: boolean;
  onToggleStarFilter?: () => void;
  starNewMessageCount?: number;
  onSearchByDate?: (date: string) => void;
  onOpenDatePicker?: () => void;
  isOffline?: boolean;
  datePickerButtonRef?: React.RefObject<HTMLButtonElement | null>;
}

const ChatHeaderComponent: React.FC<ChatHeaderProps> = ({
  selectedCustomer,
  loading,
  onRefresh,
  onSearch,
  onMore,
  onOpenInfo,
  onBack,
  starFilter = false,
  onToggleStarFilter,
  starNewMessageCount = 0,
  onSearchByDate,
  onOpenDatePicker,
  isOffline = false,
  datePickerButtonRef,
}) => {
  const isMobile = useIsMobile();

  if (!selectedCustomer) return null;

  const name = getCustomerDisplayName(selectedCustomer);
  const isGroup = (selectedCustomer as { IsGroup?: number }).IsGroup === 1;
  const groupDesc = (selectedCustomer as { GroupDesc?: string }).GroupDesc;
  const email = (selectedCustomer as { Email?: string }).Email;
  const displayEmail = isGroup ? (groupDesc || "") : (email || "");

  return (
    <div className="chat-header no-select">
      <div className="chat-header__left">
        {isMobile && onBack && (
          <IconButton
            onClick={onBack}
            size="small"
            className="chat-header__back tap-target"
            aria-label="Back to conversations"
            sx={{ flexShrink: 0 }}
          >
            <ArrowLeft size={22} />
          </IconButton>
        )}
        <div
          style={{
            width: isMobile ? 36 : 40,
            height: isMobile ? 36 : 40,
            marginRight: isMobile ? 8 : 10,
            cursor: "pointer",
            flexShrink: 0,
          }}
          onClick={onOpenInfo}
        >
          <ConversationAvatar member={selectedCustomer} size={isMobile ? 36 : 40} />
        </div>
        <div className="chat-header__info" onClick={onOpenInfo} style={{ cursor: "pointer" }}>
          <Typography variant="subtitle1" className="chat-header__name" component="span" noWrap>
            {name}
          </Typography>
          {displayEmail ? (
            <Typography variant="body2" className="chat-header__status" component="span" noWrap>
              {displayEmail}
            </Typography>
          ) : null}
        </div>
      </div>

      <div className="chat-header__right">
        {isOffline && (
          <Tooltip title="You're offline. Viewing saved messages. New messages will be sent when you reconnect." arrow>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: isMobile ? 32 : 28,
                height: isMobile ? 32 : 28,
                borderRadius: "50%",
                backgroundColor: "rgba(211, 47, 47, 0.12)",
                color: "var(--color-error, #d32f2f)",
                flexShrink: 0,
              }}
            >
              <WifiOff size={isMobile ? 18 : 16} />
            </Box>
          </Tooltip>
        )}
        {!isMobile && (
          <Tooltip title={isOffline ? "You're offline" : "Refresh"} arrow>
            <span>
              <IconButton
                size="small"
                onClick={onRefresh}
                disabled={loading || isOffline}
                className="chat-header__btn"
              >
                <RefreshCw size={18} className={loading ? "spin" : ""} />
              </IconButton>
            </span>
          </Tooltip>
        )}
        <Tooltip title="Search messages" arrow>
          <IconButton size="small" onClick={onSearch} className="chat-header__btn">
            <Search size={isMobile ? 22 : 20} />
          </IconButton>
        </Tooltip>
        {!isMobile && onSearchByDate && (
          <Tooltip title="Jump to date" arrow>
            <IconButton
              ref={datePickerButtonRef}
              size="small"
              onClick={() => onOpenDatePicker?.()}
              className="chat-header__btn"
            >
              <Calendar size={20} />
            </IconButton>
          </Tooltip>
        )}
        {!isMobile && onToggleStarFilter && (
          <Tooltip title={starFilter ? "Show all messages" : "Show starred only"} arrow>
            <IconButton
              size="small"
              onClick={onToggleStarFilter}
              className="chat-header__btn"
              sx={{ position: "relative" }}
            >
              <Star
                size={isMobile ? 22 : 20}
                fill={starFilter ? "#FFD700" : "none"}
                color={starFilter ? "#FFD700" : "currentColor"}
              />
              {/* {starFilter && starNewMessageCount > 0 && (
                <Box
                  sx={{
                    position: "absolute",
                    top: -2,
                    right: -2,
                    minWidth: 16,
                    height: 16,
                    borderRadius: 8,
                    backgroundColor: "error.main",
                    color: "#fff",
                    fontSize: 10,
                    fontWeight: 600,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    px: 0.5,
                    lineHeight: 1,
                  }}
                >
                  {starNewMessageCount > 99 ? "99+" : starNewMessageCount}
                </Box>
              )} */}
            </IconButton>
          </Tooltip>
        )}
        <Tooltip title="More options" arrow>
          <IconButton size="small" onClick={onMore} className="chat-header__btn">
            <EllipsisVertical size={isMobile ? 22 : 20} />
          </IconButton>
        </Tooltip>
      </div>
    </div>
  );
};

export const ChatHeader = memo(ChatHeaderComponent);
