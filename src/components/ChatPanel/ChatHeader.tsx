"use client";

import { memo, useState, useCallback, useRef } from "react";
import { Typography, IconButton, Tooltip, Box } from "@mui/material";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
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
  isOffline?: boolean;
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
  isOffline = false,
}) => {
  const isMobile = useIsMobile();
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const calendarBtnRef = useRef<HTMLButtonElement | null>(null);

  const toApiDate = (date: Date | null): string => {
    if (!date) return "";
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  const handleDateAccept = useCallback(
    (value: Date | null) => {
      const apiDate = toApiDate(value);
      if (apiDate && onSearchByDate) {
        onSearchByDate(apiDate);
      }
      setDatePickerOpen(false);
    },
    [onSearchByDate]
  );

  if (!selectedCustomer) return null;

  const name = getCustomerDisplayName(selectedCustomer);
  const isGroup = (selectedCustomer as { IsGroup?: number }).IsGroup === 1;
  const groupDesc = (selectedCustomer as { GroupDesc?: string }).GroupDesc;
  const email = (selectedCustomer as { Email?: string }).Email;
  // For groups: show GroupDesc. For direct chats: show email.
  const displayEmail = isGroup ? (groupDesc || "") : (email || "");

  return (
    <div className="chat-header no-select">
      <div className="chat-header__left">
        {/* Back button — mobile only (WhatsApp-like: go back to conversation list) */}
        {isMobile && onBack && (
          <IconButton
            onClick={onBack}
            size="small"
            className="chat-header__back tap-target"
            aria-label="Back to conversations"
            sx={{ flexShrink: 0, mr: 0.5 }}
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
        {/* Refresh — hidden on mobile to save space (available in more menu) */}
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
        {onSearchByDate && (
          <Tooltip title="Jump to date" arrow>
            <IconButton
              ref={calendarBtnRef}
              size="small"
              onClick={() => setDatePickerOpen(true)}
              className="chat-header__btn"
            >
              <Calendar size={isMobile ? 22 : 20} />
            </IconButton>
          </Tooltip>
        )}
        {onSearchByDate && (
          <DatePicker
            open={datePickerOpen}
            onClose={() => setDatePickerOpen(false)}
            onAccept={handleDateAccept}
            value={null}
            onChange={() => {}}
            maxDate={new Date()}
            slotProps={{
              textField: {
                sx: {
                  // Keep in DOM but invisible so the Popper can anchor to it.
                  // Position it over the calendar button so the picker opens there.
                  position: "absolute",
                  width: 0,
                  height: 0,
                  opacity: 0,
                  overflow: "hidden",
                  pointerEvents: "none",
                  left: calendarBtnRef.current?.offsetLeft ?? 0,
                  top: calendarBtnRef.current?.offsetTop ?? 0,
                },
              },
              desktopPaper: {
                sx: {
                  borderRadius: "16px",
                  backgroundColor: "var(--color-surface-elevated)",
                  border: "1px solid var(--color-border-light)",
                  boxShadow: "var(--shadow-picker)",
                  overflow: "hidden",
                },
              },
              mobilePaper: {
                sx: {
                  borderRadius: "16px",
                  backgroundColor: "var(--color-surface-elevated)",
                  border: "1px solid var(--color-border-light)",
                  boxShadow: "var(--shadow-picker)",
                  overflow: "hidden",
                },
              },
            }}
          />
        )}
        {onToggleStarFilter && (
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
              {starFilter && starNewMessageCount > 0 && (
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
              )}
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
