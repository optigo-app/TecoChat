"use client";

// Ported from OldChatReactCode/src/components/ForwardMessage/ForwardMessage.js
// MUI Dialog for forwarding a message to multiple conversations.

import {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useDeferredValue,
  useRef,
} from "react";
import {
  Dialog,
  TextField,
  Avatar,
  Box,
  Typography,
  IconButton,
  ListItemAvatar,
  ListItemText,
  Checkbox,
  InputAdornment,
  useTheme,
} from "@mui/material";
import { X, Send, Search } from "lucide-react";
import { useLoginContext } from "../../contexts/LoginData";
import { getForwardListApi } from "../../API/SendMessage/forwardlistApi";
import { getWhatsAppAvatarConfig } from "../../utils/globalFunc";
import "./ForwardMessage.scss";

interface ForwardContact {
  Type?: string;
  ConversationId?: string | number;
  UserId?: string | number;
  UserName?: string;
  DisplayName: string;
  ProfileImageUrl?: string;
  id: string | number;
  subtitle?: string;
}

interface ForwardMessageProps {
  message: any;
  onSend: (contacts: ForwardContact[]) => void;
  onClose: () => void;
  anchorEl?: HTMLElement | null;
  open: boolean;
  isCentered?: boolean;
}

const ForwardMessage = ({
  message: _message,
  onSend,
  onClose,
  open,
}: ForwardMessageProps) => {
  const theme = useTheme();
  const { auth } = useLoginContext();
  const [selectedContacts, setSelectedContacts] = useState<ForwardContact[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const [loading, setLoading] = useState(false);
  const [chatMembers, setChatMembers] = useState<{
    data: ForwardContact[];
    total: number;
  }>({ data: [], total: 0 });
  const [otherContacts, setOtherContacts] = useState<{
    data: ForwardContact[];
    total: number;
  }>({ data: [], total: 0 });

  const selectedIds = useMemo(() => {
    return new Set((selectedContacts || []).map((c) => c?.id).filter(Boolean));
  }, [selectedContacts]);

  const loadMembers = async () => {
    if (loading) return;
    if (!auth?.token || (!auth?.userId && !auth?.id)) return;
    setLoading(true);
    try {
      const response = await getForwardListApi(auth, {
        fLabel: "Forward Message",
      });

      // rd = recent chats (conversations), rd1 = other contacts (employees)
      const rawRd = response?.Data?.rd || response?.rd || [];
      const rawRd1 = response?.Data?.rd1 || response?.rd1 || [];

      const mapItems = (items: any[]): ForwardContact[] => {
        const safeItems = Array.isArray(items) ? items : [];
        return safeItems.map((item: any) => {
          // Two flows:
          // 1. Conversation contacts (rd): have ReceiverId + ConversationId
          //    → use ReceiverId as the user id
          // 2. Non-conversation contacts (rd1): have UserId (no ConversationId)
          //    → use UserId as the user id
          const userId = item.ReceiverId || item.UserId;
          const rawId = item.ConversationId || userId;
          const id = Array.isArray(rawId) ? rawId.join("-") : rawId;

          // Display name: prefer UserName, fall back to DisplayName
          const displayName = item.UserName || item.DisplayName || "";
          // Subtitle: only show if it's DIFFERENT from the display name
          // (avoids showing the name twice)
          const subtitleRaw = item.DisplayName || "";
          const subtitle = subtitleRaw && subtitleRaw !== displayName ? subtitleRaw : "";

          return {
            Type: item.Type,
            ConversationId: item.ConversationId,
            UserId: userId,
            UserName: item.UserName ?? "",
            DisplayName: displayName,
            ProfileImageUrl: item.ProfileImageUrl,
            id,
            subtitle,
          };
        });
      };

      const mappedChats = mapItems(rawRd);
      const mappedContacts = mapItems(rawRd1);

      setChatMembers({ data: mappedChats, total: mappedChats.length });
      setOtherContacts({ data: mappedContacts, total: mappedContacts.length });
    } catch (error) {
      console.error("Error loading members:", error);
      setChatMembers({ data: [], total: 0 });
      setOtherContacts({ data: [], total: 0 });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      loadMembers();
    } else {
      setSelectedContacts([]);
      setSearchTerm("");
    }
  }, [open, auth?.token, auth?.userId, auth?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const recentChats = useMemo(() => chatMembers.data, [chatMembers.data]);
  const otherContactList = useMemo(() => otherContacts.data, [otherContacts.data]);

  const normalizedSearchTerm = useMemo(() => {
    return String(deferredSearchTerm || "").trim().toLowerCase();
  }, [deferredSearchTerm]);

  const filterList = (list: ForwardContact[]) => {
    if (!normalizedSearchTerm) return list;
    return list.filter((contact) =>
      String(contact?.DisplayName || "")
        .toLowerCase()
        .includes(normalizedSearchTerm)
    );
  };

  const filteredRecentChats = useMemo(
    () => filterList(recentChats),
    [recentChats, normalizedSearchTerm]
  );
  const filteredOtherContacts = useMemo(
    () => filterList(otherContactList),
    [otherContactList, normalizedSearchTerm]
  );

  // Combined flat list for keyboard navigation
  const flatList = useMemo(
    () => [...filteredRecentChats, ...filteredOtherContacts],
    [filteredRecentChats, filteredOtherContacts]
  );

  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const listRef = useRef<HTMLDivElement>(null);

  const handleContactSelect = useCallback((contact: ForwardContact) => {
    setSelectedContacts((prev) => {
      const isSelected = prev.find((c) => c.id === contact.id);
      return isSelected ? prev.filter((c) => c.id !== contact.id) : [...prev, contact];
    });
  }, []);

  // Reset highlight when search changes
  useEffect(() => {
    setHighlightedIndex(-1);
  }, [normalizedSearchTerm]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedIndex < 0 || !listRef.current) return;
    const items = listRef.current.querySelectorAll<HTMLElement>(".fm-contactItem");
    const el = items[highlightedIndex];
    if (el) {
      el.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [highlightedIndex]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < flatList.length - 1 ? prev + 1 : 0
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev > 0 ? prev - 1 : flatList.length - 1
        );
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < flatList.length) {
          handleContactSelect(flatList[highlightedIndex]);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    },
    [flatList, highlightedIndex, handleContactSelect, onClose]
  );

  const selectedSummaryText = useMemo(() => {
    return (selectedContacts || [])
      .map((c) => c?.DisplayName)
      .filter(Boolean)
      .join(", ");
  }, [selectedContacts]);

  const handleSend = useCallback(() => {
    if (selectedContacts.length > 0) {
      onSend(selectedContacts);
      onClose();
    }
  }, [onClose, onSend, selectedContacts]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={false}
      slotProps={{
        backdrop: {
          sx: { backgroundColor: "rgba(0, 0, 0, 0.5)" },
        },
        paper: {
          elevation: 0,
          sx: {
            width: 440,
            maxWidth: "94vw",
            height: 620,
            maxHeight: "90vh",
            borderRadius: "20px",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            backgroundColor: "var(--color-surface)",
            backgroundImage: "none",
          },
        },
      }}
      sx={{ zIndex: 10500 }}
      onKeyDown={handleKeyDown}
    >
      {/* Header */}
      <div className="fm-header">
        <div className="fm-headerLeft">
          <IconButton size="small" onClick={onClose} className="fm-closeBtn">
            <X size={20} />
          </IconButton>
          <Typography className="fm-title">Forward message to</Typography>
        </div>
      </div>

      {/* Search Field */}
      <div className="fm-search">
        <TextField
          fullWidth
          size="small"
          placeholder="Search name or number"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <Search size={18} />
                </InputAdornment>
              ),
            },
          }}
        />
      </div>

      {/* Contact List */}
      <Box className="fm-contacts" ref={listRef}>
        {loading ? (
          <div className="fm-empty">
            <div className="fm-emptyText">Loading...</div>
          </div>
        ) : filteredRecentChats.length === 0 && filteredOtherContacts.length === 0 ? (
          <div className="fm-empty">
            <div className="fm-emptyText">No matches found</div>
          </div>
        ) : (
          <>
            {filteredRecentChats.length > 0 && (
              <>
                <div className="fm-sectionTitle">Recent chats</div>
                {filteredRecentChats.map((contact, index) => {
                  const isSelected = selectedIds.has(contact.id);
                  const isHighlighted = highlightedIndex === index;
                  const uniqueKey = `rd-${contact.Type || "c"}-${contact.ConversationId || ""}-${contact.UserId || ""}-${index}`;
                  return (
                    <div
                      key={uniqueKey}
                      onClick={() => handleContactSelect(contact)}
                      className={`fm-contactItem ${isSelected ? "isSelected" : ""} ${isHighlighted ? "isHighlighted" : ""}`}
                      role="button"
                      tabIndex={0}
                    >
                      <Checkbox
                        size="small"
                        checked={isSelected}
                        className="fm-rowCheckbox"
                        disableRipple
                        sx={{
                          color: theme.palette.text.secondary,
                          "&.Mui-checked": {
                            color: theme.palette.primary.main,
                          },
                        }}
                      />
                      <ListItemAvatar sx={{ minWidth: 40 }}>
                        <Avatar
                          src={contact?.ProfileImageUrl || undefined}
                          {...getWhatsAppAvatarConfig(contact?.DisplayName, 32)}
                        />
                      </ListItemAvatar>
                      <ListItemText
                        primary={contact.DisplayName}
                        secondary={contact?.subtitle || ""}
                        slotProps={{
                          primary: { sx: { fontSize: "0.95rem", fontWeight: 600 } },
                          secondary: { sx: { fontSize: "0.8rem" } },
                        }}
                      />
                    </div>
                  );
                })}
              </>
            )}

            {filteredOtherContacts.length > 0 && (
              <>
                <div className="fm-sectionTitle fm-sectionTitle--divider">
                  Other contacts
                </div>
                {filteredOtherContacts.map((contact, index) => {
                  const isSelected = selectedIds.has(contact.id);
                  const flatIdx = filteredRecentChats.length + index;
                  const isHighlighted = highlightedIndex === flatIdx;
                  const uniqueKey = `rd1-${contact.Type || "c"}-${contact.ConversationId || ""}-${contact.UserId || ""}-${index}`;
                  return (
                    <div
                      key={uniqueKey}
                      onClick={() => handleContactSelect(contact)}
                      className={`fm-contactItem ${isSelected ? "isSelected" : ""} ${isHighlighted ? "isHighlighted" : ""}`}
                      role="button"
                      tabIndex={0}
                    >
                      <Checkbox
                        size="small"
                        checked={isSelected}
                        className="fm-rowCheckbox"
                        disableRipple
                        sx={{
                          color: theme.palette.text.secondary,
                          "&.Mui-checked": {
                            color: theme.palette.primary.main,
                          },
                        }}
                      />
                      <ListItemAvatar sx={{ minWidth: 40 }}>
                        <Avatar
                          src={contact?.ProfileImageUrl || undefined}
                          {...getWhatsAppAvatarConfig(contact?.DisplayName, 32)}
                        />
                      </ListItemAvatar>
                      <ListItemText
                        primary={contact.DisplayName}
                        secondary={contact?.subtitle || ""}
                        slotProps={{
                          primary: { sx: { fontSize: "0.95rem", fontWeight: 600 } },
                          secondary: { sx: { fontSize: "0.8rem" } },
                        }}
                      />
                    </div>
                  );
                })}
              </>
            )}
          </>
        )}
      </Box>

      {/* Action Buttons */}
      {selectedContacts.length > 0 && (
        <div className="fm-actions">
          <div className="fm-selectedFooterText" title={selectedSummaryText}>
            {selectedSummaryText}
          </div>
          <IconButton className="fm-sendFab" onClick={handleSend}>
            <Send size={20} />
          </IconButton>
        </div>
      )}
    </Dialog>
  );
};

export default ForwardMessage;
