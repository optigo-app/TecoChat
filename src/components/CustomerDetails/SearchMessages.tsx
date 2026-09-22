"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import {
  Typography,
  Box,
  TextField,
  InputAdornment,
  List,
  ListItem,
  Skeleton,
  IconButton,
  Tooltip,
  alpha,
  useTheme,
} from "@mui/material";
import { DateCalendar } from "@mui/x-date-pickers/DateCalendar";
import { Popover } from "@mui/material";
import { Search, Calendar } from "lucide-react";
import { formatDateTime } from "../../utils/dateUtils";
import { renderMessageText } from "../../utils/messageTextRenderer";

interface SearchMessage {
  MessageId?: string | number;
  id?: string | number;
  Message?: string;
  SenderInfo?: string;
  Direction?: number;
  DateTime?: string;
  [key: string]: unknown;
}

interface SearchMessagesProps {
  searchResults?: SearchMessage[];
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  onResultClick: (msg: SearchMessage) => void;
  isSearching?: boolean;
  onSearchMessages?: (query: string) => void;
  onSearchByDate?: (date: string) => void;
}

const SearchMessages = ({
  searchResults = [],
  searchQuery,
  setSearchQuery,
  onResultClick,
  isSearching = false,
  onSearchMessages,
  onSearchByDate,
}: SearchMessagesProps) => {
  const theme = useTheme();
  const [localQuery, setLocalQuery] = useState(searchQuery || "");
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const listRef = useRef<HTMLUListElement | null>(null);
  const calendarBtnRef = useRef<HTMLButtonElement | null>(null);

  // Sync localQuery when parent searchQuery is cleared (e.g. after clearing chat).
  // Only react to searchQuery changes — NOT localQuery, otherwise this effect
  // fires on every keystroke and resets the input (searchQuery is still "" until
  // the debounced search fires, so it would clear localQuery immediately).
  useEffect(() => {
    if (searchQuery === "") {
      setLocalQuery("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (onSearchMessages) {
        onSearchMessages(localQuery);
        setSearchQuery(localQuery);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [localQuery, onSearchMessages, setSearchQuery]);

  // Reset highlight when results change or query changes
  useEffect(() => {
    setHighlightedIndex(-1);
  }, [searchResults, localQuery]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedIndex < 0 || !listRef.current) return;
    const items = listRef.current.querySelectorAll<HTMLElement>(".search-result-card");
    const el = items[highlightedIndex];
    if (el) {
      el.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [highlightedIndex]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (isSearching || searchResults.length === 0) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < searchResults.length - 1 ? prev + 1 : 0
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev > 0 ? prev - 1 : searchResults.length - 1
        );
      } else if (e.key === "Enter") {
        e.preventDefault();
        const idx = highlightedIndex >= 0 ? highlightedIndex : 0;
        if (idx < searchResults.length) {
          onResultClick(searchResults[idx]);
        }
      }
    },
    [isSearching, searchResults, highlightedIndex, onResultClick]
  );

  const formatDate = (dateStr?: string) => formatDateTime(dateStr, "dateLocal");
  const formatTime = (dateStr?: string) => formatDateTime(dateStr, "time");

  const toApiDate = (date: Date | null): string => {
    if (!date) return "";
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  return (
    <div className="search-messages-container" onKeyDown={handleKeyDown}>
      <div
        className="search-input-wrapper"
        style={{ display: "flex", alignItems: "center", gap: 8 }}
      >
        {onSearchByDate && (
          <Tooltip title="Jump to date" arrow>
            <IconButton
              ref={calendarBtnRef}
              size="small"
              onClick={() => setDatePickerOpen(true)}
              sx={{
                flexShrink: 0,
                width: 40,
                height: 40,
                borderRadius: "100px",
                backgroundColor: "var(--color-wa-surface-3)",
                color: "var(--color-text-secondary)",
                border: "none",
                transition: "background-color 0.15s ease, color 0.15s ease, box-shadow 0.15s ease",
                "&:hover": {
                  backgroundColor: "var(--color-wa-surface-2)",
                  color: "var(--color-primary)",
                  boxShadow: "none",
                },
              }}
            >
              <Calendar size={20} />
            </IconButton>
          </Tooltip>
        )}
        <Box sx={{ flex: "1 1 auto", minWidth: 0 }}>
          <TextField
            fullWidth
            placeholder="Search messages..."
            variant="outlined"
            size="small"
            value={localQuery}
            onChange={(e) => setLocalQuery(e.target.value)}
            autoFocus
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <Search size={18} color="var(--color-text-secondary)" />
                  </InputAdornment>
                ),
                className: "search-textfield-inner",
              },
            }}
          />
        </Box>
        {/* Date picker — Popover anchored to the calendar button, opens
            right below the icon. No hidden text field, no body scroll.
            Tap a day → immediately confirms and closes (WhatsApp-like). */}
        {onSearchByDate && (
          <Popover
            open={datePickerOpen}
            anchorEl={calendarBtnRef.current}
            onClose={() => setDatePickerOpen(false)}
            transitionDuration={0}
            anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
            transformOrigin={{ vertical: "top", horizontal: "left" }}
            slotProps={{
              paper: {
                sx: {
                  borderRadius: "16px",
                  backgroundColor: "var(--color-surface-elevated)",
                  border: `1px solid ${alpha(theme.palette.text.primary, 0.08)}`,
                  boxShadow: "var(--shadow-picker)",
                  overflow: "hidden",
                  p: 0,
                  "& .MuiDateCalendar-root": {
                    width: 320,
                    height: 320,
                    backgroundColor: "transparent",
                    color: "var(--color-title)",
                  },
                  "& .MuiDayCalendar-weekDayLabel": {
                    color: "var(--color-text-secondary)",
                  },
                  "& .MuiPickerDay-today": {
                    borderColor: theme.palette.primary.main,
                  },
                  "& .MuiPickerDay-root:not(.Mui-selected):not(.Mui-disabled):hover": {
                    backgroundColor: alpha(theme.palette.primary.main, 0.15),
                  },
                  "& .Mui-selected": {
                    backgroundColor: `${theme.palette.primary.main} !important`,
                    color: "#fff !important",
                  },
                  "& .MuiPickersCalendarHeader-label": {
                    color: "var(--color-title)",
                  },
                  "& .MuiPickersArrowSwitcher-button": {
                    color: "var(--color-text-secondary)",
                  },
                },
              },
            }}
          >
            <DateCalendar
              value={null}
              onChange={(newValue) => {
                if (newValue) {
                  const apiDate = toApiDate(newValue);
                  if (apiDate && onSearchByDate) {
                    onSearchByDate(apiDate);
                  }
                  setDatePickerOpen(false);
                }
              }}
              maxDate={new Date()}
              openTo="day"
              sx={{ backgroundColor: "transparent" }}
            />
          </Popover>
        )}
      </div>

      <div className="search-results-viewport">
        {isSearching ? (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, p: 2 }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <Box key={i} sx={{ display: "flex", flexDirection: "column", gap: 1, p: 1.5 }}>
                <Skeleton variant="text" width="40%" height={16} />
                <Skeleton variant="text" width="90%" height={20} />
                <Skeleton variant="text" width="70%" height={20} />
              </Box>
            ))}
          </Box>
        ) : localQuery.trim() === "" ? (
          <div className="search-empty-state">
            <Typography variant="body2">Search for messages within this chat.</Typography>
          </div>
        ) : searchResults.length === 0 ? (
          <div className="search-empty-state">
            <Typography variant="body2">No messages found for "{localQuery}"</Typography>
          </div>
        ) : (
          <List className="search-results-list" ref={listRef}>
            {searchResults.map((msg, index) => {
              const isHighlighted = highlightedIndex === index;
              return (
                <ListItem
                  key={msg.MessageId || msg.id || index}
                  onClick={() => onResultClick(msg)}
                  className="search-result-card"
                  sx={{
                    cursor: "pointer",
                    display: "block",
                    padding: "14px 16px",
                    margin: "8px 12px",
                    borderRadius: "12px",
                    width: "calc(100% - 24px)",
                    backgroundColor: isHighlighted
                      ? alpha(theme.palette.primary.main, 0.08)
                      : "var(--color-surface-elevated)",
                    border: "none",
                    boxShadow: isHighlighted
                      ? "0 4px 16px rgba(0, 0, 0, 0.2)"
                      : "0 2px 8px rgba(0, 0, 0, 0.12)",
                    transition: "all 0.15s ease",
                    "&:hover": {
                      backgroundColor: alpha(theme.palette.primary.main, 0.05),
                      boxShadow: "0 4px 16px rgba(0, 0, 0, 0.2)",
                      transform: "translateY(-1px)",
                    },
                  }}
                >
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                  {/* Message Content - Primary Focus */}
                  <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5 }}>
                    <Typography
                      variant="body2"
                      sx={{
                        color: "var(--color-title)",
                        fontSize: "0.925rem",
                        lineHeight: 1.5,
                        fontWeight: 400,
                        display: "-webkit-box",
                        WebkitLineClamp: 4,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                        wordBreak: "break-word",
                      }}
                    >
                      {renderMessageText(msg.Message || "", undefined, localQuery)}
                    </Typography>
                  </Box>

                  {/* Footer Context - Secondary Info */}
                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      pt: 1.2,
                      borderTop: "1px solid var(--color-sidebar-border)",
                    }}
                  >
                    <Typography
                      variant="caption"
                      sx={{
                        fontWeight: 600,
                        fontSize: "0.7rem",
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                        color: "var(--color-text-secondary)",
                      }}
                    >
                      {msg.SenderInfo || (msg.Direction === 1 ? "Me" : "System")}
                    </Typography>

                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1,
                        color: "var(--color-text-secondary)",
                      }}
                    >
                      <Typography variant="caption" sx={{ fontSize: "0.725rem" }}>
                        {formatDate(msg.DateTime)}
                      </Typography>
                      <span style={{ fontSize: "10px", opacity: 0.5 }}>•</span>
                      <Typography variant="caption" sx={{ fontSize: "0.725rem" }}>
                        {formatTime(msg.DateTime)}
                      </Typography>
                    </Box>
                  </Box>
                </Box>
              </ListItem>
            );
            })}
          </List>
        )}
      </div>
    </div>
  );
};

export default SearchMessages;
