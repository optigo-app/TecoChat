"use client";

// Ported from OldChatReactCode/src/components/ReusableComponent/AddMemberDialog.jsx
// Multi-purpose dialog for adding members to a group, searching participants,
// editing group admins, and viewing past participants.
// Replaces lodash.debounce with a custom debounce utility.

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  IconButton,
  TextField,
  InputAdornment,
  Box,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Avatar,
  Checkbox,
  CircularProgress,
} from "@mui/material";
import { Search, X as Clear, Check } from "lucide-react";
import { fetchCustomerLists } from "../../API/CustomerLists/CustomerLists";
import { PastParticipantListApi } from "../../API/Groups/PastParticipantListApi";
import { useLoginContext } from "../../context/LoginData";
import {
  getCustomerDisplayName,
  getWhatsAppAvatarConfig,
} from "../../utils/globalFunc";
import { highlightText } from "../../utils/messageTextRenderer";

type AddMemberMode = "add" | "search" | "editAdmins" | "viewPastParticipants";

interface AddMemberDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit?: (selectedIds: (string | number)[]) => void;
  existingMemberIds?: (string | number)[];
  mode?: AddMemberMode;
  groupMembers?: any[];
  onMemberClick?: (event: React.MouseEvent, member: any) => void;
  preSelectedIds?: (string | number)[];
  disabledIds?: (string | number)[];
  conversationId?: string | number;
}

// Simple debounce (replaces lodash.debounce)
function useDebounce<T extends (...args: any[]) => void>(
  fn: T,
  delay: number
): T & { cancel: () => void } {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const debounced = useCallback(
    (...args: Parameters<T>) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => fnRef.current(...args), delay);
    },
    [delay]
  ) as T & { cancel: () => void };

  debounced.cancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return debounced;
}

const AddMemberDialog = ({
  open,
  onClose,
  onSubmit,
  existingMemberIds = [],
  mode = "add",
  groupMembers = [],
  onMemberClick,
  preSelectedIds = [],
  disabledIds = [],
  conversationId,
}: AddMemberDialogProps) => {
  const { auth } = useLoginContext();
  const [searchTerm, setSearchTerm] = useState("");
  const [availableCustomers, setAvailableCustomers] = useState<any[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<(string | number)[]>([]);
  const pastMembersCacheRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const listContainerRef = useRef<HTMLDivElement>(null);

  const fetchCustomers = async (search = "") => {
    setIsLoading(true);
    if (mode === "search" || mode === "editAdmins") {
      const lowerSearch = search.toLowerCase();
      const filtered = groupMembers.filter((m: any) => {
        const name = getCustomerDisplayName(m).toLowerCase();
        const phone = m.Phone || m.MobileNo || "";
        return name.includes(lowerSearch) || phone.includes(search);
      });
      const transformed = filtered.map((item: any) => ({
        ...item,
        UserId: item.UserId || item.Id || item.id,
      }));
      if (mode === "editAdmins") {
        transformed.sort((a, b) => {
          const aIsAdmin = disabledIds.includes(a.UserId) ? 1 : 0;
          const bIsAdmin = disabledIds.includes(b.UserId) ? 1 : 0;
          return bIsAdmin - aIsAdmin;
        });
      }
      setAvailableCustomers(transformed);
      setIsLoading(false);
      return;
    }

    if (mode === "viewPastParticipants") {
      let data = pastMembersCacheRef.current;
      if (!data && conversationId) {
        try {
          const response = await PastParticipantListApi(auth, { conversationId });
          data = response?.Data?.rd || response?.rd || [];
          pastMembersCacheRef.current = data;
        } catch {
          data = [];
        }
      }
      const lowerSearch = search.toLowerCase();
      const filtered = (data || []).filter((m: any) => {
        const name = (m.MemberName || m.DisplayName || m.Name || "").toLowerCase();
        const email = (m.DisplayEmail || m.Email || "").toLowerCase();
        return name.includes(lowerSearch) || email.includes(lowerSearch);
      });
      const transformed = filtered.map((item: any) => ({
        ...item,
        UserId: item.UserId || item.Id || item.id,
        DisplayName: item.MemberName || item.Name || "User",
        DisplayEmail: item.DisplayEmail || item.Email || "",
      }));
      setAvailableCustomers(transformed);
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetchCustomerLists(1, 100, search, auth);
      if (res?.data) {
        const transformed = res.data.map((item: any) => ({
          ...item,
          UserId: item.UserId || item.Id || item.id,
        }));
        setAvailableCustomers(transformed);
      }
    } catch (error) {
      console.error("Error fetching customers:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCustomersRef = useRef(fetchCustomers);
  fetchCustomersRef.current = fetchCustomers;

  const debouncedFetch = useDebounce((val: string) => {
    fetchCustomersRef.current(val);
  }, 500);

  useEffect(() => {
    if (open && (mode === "search" || mode === "editAdmins")) {
      fetchCustomers(searchTerm);
    }
  }, [groupMembers, mode, open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (open) {
      setSearchTerm("");
      pastMembersCacheRef.current = null;
      fetchCustomers();
      setSelectedMembers(preSelectedIds);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleToggleMember = useCallback(
    (userId: string | number) => {
      if (disabledIds.includes(userId)) return;
      setSelectedMembers((prev) =>
        prev.includes(userId) ? prev.filter((mid) => mid !== userId) : [...prev, userId]
      );
    },
    [disabledIds]
  );

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchTerm(val);
    if (mode === "search" || mode === "editAdmins" || mode === "viewPastParticipants") {
      fetchCustomers(val);
    } else {
      debouncedFetch(val);
    }
  };

  const filteredAvailableCustomers = availableCustomers.filter((cust) =>
    mode === "search" || mode === "viewPastParticipants"
      ? true
      : mode === "editAdmins"
      ? true
      : !existingMemberIds.includes(cust.UserId)
  );

  useEffect(() => {
    setSelectedIndex(-1);
  }, [searchTerm, availableCustomers]);

  const scrollToSelectedIndex = useCallback((index: number) => {
    if (listContainerRef.current && index >= 0) {
      const container = listContainerRef.current;
      const items = container.querySelectorAll(".member-list-item");
      const targetItem = items[index] as HTMLElement;
      if (targetItem) {
        const containerRect = container.getBoundingClientRect();
        const itemRect = targetItem.getBoundingClientRect();
        if (itemRect.bottom > containerRect.bottom) {
          container.scrollTop += itemRect.bottom - containerRect.bottom;
        } else if (itemRect.top < containerRect.top) {
          container.scrollTop -= containerRect.top - itemRect.top;
        }
      }
    }
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!filteredAvailableCustomers?.length) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => {
        const next = prev < filteredAvailableCustomers.length - 1 ? prev + 1 : prev;
        scrollToSelectedIndex(next);
        return next;
      });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => {
        const next = prev > 0 ? prev - 1 : 0;
        scrollToSelectedIndex(next);
        return next;
      });
    } else if (e.key === "Enter") {
      if (selectedIndex >= 0 && selectedIndex < filteredAvailableCustomers.length) {
        const cust = filteredAvailableCustomers[selectedIndex];
        if (mode === "search") {
          onMemberClick?.(e as any, cust);
        } else if (mode !== "viewPastParticipants") {
          handleToggleMember(cust.UserId);
        }
      }
    }
  };

  const handleSubmit = () => {
    if (mode === "editAdmins") {
      onSubmit?.(selectedMembers);
    } else {
      const newlySelected = selectedMembers.filter((id) => !disabledIds.includes(id));
      onSubmit?.(newlySelected);
    }
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="xs"
      className="add-member-dialog"
      slotProps={{
        paper: {
          sx: { borderRadius: "16px", height: "80vh" },
        },
      }}
    >
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 2, pb: 1, fontWeight: 600 }}>
        <IconButton onClick={onClose} size="small">
          <Clear size={20} />
        </IconButton>
        {mode === "search"
          ? "Search participants"
          : mode === "editAdmins"
          ? "Edit group admins"
          : mode === "viewPastParticipants"
          ? "Past participants"
          : "Add member"}
      </DialogTitle>
      <DialogContent sx={{ p: "0 24px" }}>
        <Box sx={{ mt: 1, mb: 2 }}>
          <TextField
            fullWidth
            variant="outlined"
            placeholder="Search name or number"
            size="small"
            value={searchTerm}
            onChange={handleSearchChange}
            onKeyDown={handleKeyDown}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <Search size={18} style={{ color: "var(--color-text-secondary)" }} />
                  </InputAdornment>
                ),
                sx: {
                  borderRadius: "24px",
                  backgroundColor: "var(--color-hover-bg)",
                  border: "none",
                  "& fieldset": { border: "none" },
                },
              },
            }}
          />
        </Box>
        <Typography
          variant="caption"
          sx={{ color: "var(--color-text-secondary)", fontWeight: 500, mb: 1, display: "block" }}
        >
          Contacts
        </Typography>
        {isLoading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress size={24} sx={{ color: "primary.main" }} />
          </Box>
        ) : filteredAvailableCustomers.length === 0 ? (
          <Box sx={{ py: 8, textAlign: "center" }}>
            <Typography
              variant="body2"
              sx={{ color: "var(--color-text-secondary)", fontWeight: 500 }}
            >
              {searchTerm ? `No results found for "${searchTerm}"` : "No participants found"}
            </Typography>
          </Box>
        ) : (
          <List
            sx={{ width: "100%", overflowY: "auto", flex: 1 }}
            ref={listContainerRef as any}
          >
            {filteredAvailableCustomers.map((cust, index) => {
              const isSelected = selectedMembers.includes(cust.UserId);
              const isDisabled = disabledIds.includes(cust.UserId);
              const isKeyboardHighlighted = index === selectedIndex;
              return (
                <ListItem
                  key={cust.UserId}
                  className="member-list-item"
                  onClick={(e) =>
                    mode === "search"
                      ? onMemberClick?.(e, cust)
                      : mode === "viewPastParticipants"
                      ? undefined
                      : handleToggleMember(cust.UserId)
                  }
                  sx={{
                    borderRadius: "8px",
                    mb: 0.5,
                    cursor:
                      mode === "viewPastParticipants"
                        ? "default"
                        : isDisabled
                        ? "default"
                        : "pointer",
                    opacity: isDisabled ? 0.7 : 1,
                    backgroundColor: isKeyboardHighlighted
                      ? "rgba(115, 103, 240, 0.08)"
                      : "transparent",
                    "&:hover": {
                      backgroundColor:
                        mode === "viewPastParticipants" || isDisabled
                          ? "transparent"
                          : "rgba(115, 103, 240, 0.04)",
                      borderRadius: 2,
                    },
                  }}
                >
                  {mode !== "search" && mode !== "viewPastParticipants" && (
                    <Checkbox
                      edge="start"
                      checked={isSelected}
                      disabled={isDisabled}
                      tabIndex={-1}
                      disableRipple
                      sx={{
                        color: "#d1d5db",
                        "&.Mui-checked": { color: "primary.main" },
                        "&.Mui-disabled": { color: "#b0bec5" },
                      }}
                    />
                  )}
                  <ListItemAvatar
                    sx={{ ml: mode === "search" || mode === "viewPastParticipants" ? 0 : 1 }}
                  >
                    <Avatar
                      {...getWhatsAppAvatarConfig(
                        cust.DisplayName || cust.CustomerName || cust.Name || cust.UserName || "User",
                        40
                      )}
                      src={cust.ProfileImage || cust.ProfileImageUrl}
                    />
                  </ListItemAvatar>
                  <ListItemText
                    primary={highlightText(getCustomerDisplayName(cust), searchTerm)}
                    secondary={highlightText(
                      (cust.UserEmail ?? cust.DisplayEmail) ?? "",
                      searchTerm
                    )}
                  />
                </ListItem>
              );
            })}
          </List>
        )}
      </DialogContent>
      <DialogActions sx={{ p: 2, justifyContent: "center" }}>
        {mode !== "search" &&
          mode !== "viewPastParticipants" &&
          (mode === "editAdmins" ||
            selectedMembers.filter((id) => !disabledIds.includes(id)).length > 0) && (
            <IconButton
              onClick={handleSubmit}
              sx={{
                backgroundColor: "primary.main",
                color: "#fff",
                width: "56px",
                height: "56px",
                "&:hover": { backgroundColor: "primary.dark" },
                boxShadow: "0 4px 12px rgba(115, 103, 240, 0.3)",
              }}
            >
              <Check size={24} />
            </IconButton>
          )}
      </DialogActions>
    </Dialog>
  );
};

export default AddMemberDialog;
