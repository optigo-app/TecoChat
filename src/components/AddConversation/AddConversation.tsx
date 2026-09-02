"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  Avatar,
  Typography,
  TextField,
  InputAdornment,
  Box,
  Button,
  IconButton,
  Skeleton,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { Search, X, User, MessageSquare, ArrowLeft } from "lucide-react";
import { usePathname } from "next/navigation";
import "./AddConversation.scss";
import {
  getCustomerAvatarSeed,
  getCustomerDisplayName,
  getWhatsAppAvatarConfig,
  hasCustomerName,
} from "../../utils/globalFunc";
import { fetchCustomerLists } from "../../API/CustomerLists/CustomerLists";
import { useLoginContext } from "../../context/LoginData";

interface AddConversationMember {
  UserId: string | number;
  ConversationId?: string | number | null;
  ConversationName?: string;
  CustomerPhone?: string;
  UserEmail?: string;
  email?: string;
  ProfileImageUrl?: string;
  name: string;
  avatarConfig: ReturnType<typeof getWhatsAppAvatarConfig>;
  IsArchived?: number;
  IsStar?: number;
  ticketStatus?: string;
  tags?: { TagId: string | number }[];
  [key: string]: unknown;
}

interface AddConversationProps {
  onCustomerSelect?: (member: AddConversationMember) => void;
  selectedCustomer?: { UserId: string | number } | null;
  selectedTag?: { Id: string | number } | null;
  selectedStatus?: string;
  onClose?: () => void;
  onBack?: () => void;
}

const AddConversation = ({
  onCustomerSelect = () => {},
  selectedCustomer = null,
  selectedTag,
  selectedStatus = "All",
  onClose,
  onBack,
}: AddConversationProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [tabValue, setTabValue] = useState(0);
  const [chatMembers, setChatMembers] = useState<{
    data: AddConversationMember[] | null;
    total: number;
  }>({ data: null, total: 0 });
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const pathname = usePathname();
  const [showEmptyState, setShowEmptyState] = useState(false);
  const containerRef = useRef<HTMLUListElement>(null);
  const pageSize = 100;
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { auth } = useLoginContext();
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [currentPage, setCurrentPage] = useState(1);

  const transformMemberData = useCallback((items: any[]): AddConversationMember[] => {
    return (
      items?.map((item) => {
        const name =
          item.UserName || item.CustomerName || getCustomerDisplayName(item);
        return {
          ...item,
          UserId: item.UserId || item.CustomerId || item.Id,
          ConversationId: item.ConversationId || null,
          ConversationName:
            item.ConversationName ||
            item.UserName ||
            item.CustomerName ||
            item.name ||
            "",
          CustomerPhone:
            item.CustomerPhone ||
            item.UserPhone ||
            item.MobileNo ||
            item.Phone ||
            "",
          name,
          email: item.UserEmail || item.email || "",
          avatar: null,
          avatarConfig: getWhatsAppAvatarConfig(getCustomerAvatarSeed(item)),
        };
      }) || []
    );
  }, []);

  const loadMembers = useCallback(
    async (page = 1, reset = false, search: string | null = null) => {
      if (loading || (!reset && !hasMore)) return;

      if (!auth?.token || !auth?.userId) {
        console.log("⚠️ No auth token available, skipping conversation load");
        return;
      }
      if (reset) {
        setChatMembers({ data: null, total: 0 });
        setShowEmptyState(false);
      }
      setLoading(true);
      try {
        const searchToUse = search !== null ? search : searchTerm;
        const response = await fetchCustomerLists(page, pageSize, searchToUse, auth);
        const transformedData = transformMemberData(response.data);

        setChatMembers((prev) => ({
          data: reset
            ? transformedData
            : [...(prev.data || []), ...transformedData],
          total: response.total,
        }));

        const moreAvailable = response?.hasMore ?? transformedData.length > 0;
        setHasMore(moreAvailable);

        if (moreAvailable) setCurrentPage(page);
      } catch (error) {
        console.error("Error loading members:", error);
      } finally {
        setLoading(false);
      }
    },
    [loading, pageSize, transformMemberData, searchTerm, auth]
  );

  useEffect(() => {
    loadMembers(1, true);
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  const debouncedSearch = useCallback(
    (value: string) => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      searchTimeoutRef.current = setTimeout(() => {
        loadMembers(1, true, value);
      }, 500);
    },
    [loadMembers]
  );

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);

    if (value === "") {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      loadMembers(1, true, "");
    } else {
      debouncedSearch(value);
    }
  };

  const handleScroll = useCallback(() => {
    if (!containerRef.current || loading || !hasMore) return;

    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;

    if (scrollTop + clientHeight >= scrollHeight - 80) {
      loadMembers(currentPage + 1, false);
    }
  }, [loading, hasMore, currentPage, loadMembers]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  const handleTabChange = (newValue: number) => {
    setTabValue(newValue);
  };

  const filteredMembers = (chatMembers?.data || [])
    .filter((member) => {
      if (pathname === "/archieve") {
        return member.IsArchived === 1;
      } else {
        return member.IsArchived !== 1;
      }
    })
    .filter((member) => {
      const myId = Number(auth?.id ?? auth?.userId);
      const memberId = Number(member?.UserId ?? (member as any)?.id);
      return myId !== memberId;
    })
    .filter((member) => {
      const isFavorite = member.IsStar === 1;
      switch (tabValue) {
        case 2:
          return isFavorite && tabValue === 2;
        default:
          return true;
      }
    })
    .filter((member) => {
      if (!selectedStatus || selectedStatus === "All") return true;
      const statusKey = selectedStatus.toLowerCase();
      const isFavorite = member.IsStar === 1;
      return (
        member.ticketStatus === statusKey ||
        (isFavorite && statusKey === "favorite")
      );
    })
    .filter((member) => {
      if (!selectedTag || selectedTag === ("All" as any)) return true;
      return (
        member.tags && member.tags.some((tag) => tag.TagId === selectedTag.Id)
      );
    });

  useEffect(() => {
    setSelectedIndex(-1);
  }, [searchTerm, tabValue, chatMembers]);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    if (!loading && chatMembers.data !== null && filteredMembers.length === 0) {
      timeout = setTimeout(() => {
        setShowEmptyState(true);
      }, 1000);
    } else {
      setShowEmptyState(false);
    }
    return () => clearTimeout(timeout);
  }, [loading, chatMembers.data, filteredMembers.length]);

  const scrollToSelectedIndex = useCallback((index: number) => {
    if (containerRef.current && index >= 0) {
      const container = containerRef.current;
      const items = container.querySelectorAll(".member-item");
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
    if (!filteredMembers?.length) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => {
        const next = prev < filteredMembers.length - 1 ? prev + 1 : prev;
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
      if (selectedIndex >= 0 && selectedIndex < filteredMembers.length) {
        onCustomerSelect(filteredMembers[selectedIndex]);
      }
    }
  };

  return (
    <div className="customer_lists_mainDiv_2">
      <div className="customer_lists_header">
        <Box className="add_conv_box">
          {onBack && (
            <IconButton onClick={onBack} size="small" className="add_conv">
              <ArrowLeft size={20} />
            </IconButton>
          )}
          <Typography variant="h6" className="header_title">
            New Chat
          </Typography>
        </Box>
        {onClose && (
          <IconButton onClick={onClose} size="small" className="add_conv">
            <X size={20} />
          </IconButton>
        )}
      </div>

      <div className="customer_lists_search">
        <TextField
          fullWidth
          placeholder="Search conversations"
          variant="outlined"
          size="small"
          value={searchTerm}
          onChange={handleSearchChange}
          onKeyDown={handleKeyDown}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <Search size={18} />
                </InputAdornment>
              ),
              endAdornment: searchTerm ? (
                <InputAdornment
                  position="end"
                  style={{ cursor: "pointer" }}
                  onClick={() => {
                    setSearchTerm("");
                    loadMembers(1, true, "");
                  }}
                >
                  <X size={18} />
                </InputAdornment>
              ) : null,
            },
          }}
        />
      </div>

      <Box
        className="customer_lists_filters"
        sx={{
          borderBottom: "1px solid rgba(0, 0, 0, 0.08)",
          px: "10px",
          py: "8px",
        }}
      >
        <Box
          sx={{
            width: "100%",
            display: "flex",
            gap: "6px",
            padding: "6px",
          }}
        >
          {[
            { label: "All", value: 0 },
            { label: "Favorite", value: 2 },
          ].map((item) => {
            const isActive = tabValue === item.value;

            return (
              <Button
                key={item.value}
                type="button"
                disableElevation
                variant="text"
                aria-pressed={isActive}
                onClick={() => handleTabChange(item.value)}
                sx={(theme) => ({
                  flex: 1,
                  borderRadius: 2,
                  textTransform: "none",
                  fontSize: "14px",
                  fontWeight: 600,
                  lineHeight: 1,
                  border: "1px solid",
                  borderColor: isActive
                    ? alpha(
                        (theme.palette as any).borderColor?.extraLight ?? "#e0e0e0",
                        0.2
                      )
                    : (theme.palette as any).borderColor?.extraLight ?? "#e0e0e0",
                  color: isActive
                    ? alpha(theme.palette.primary.main, 1)
                    : theme.palette.text.secondary,
                  backgroundColor: isActive
                    ? alpha(theme.palette.primary.main, 0.14)
                    : "transparent",
                  transition:
                    "background-color 200ms ease, color 200ms ease, transform 200ms ease",
                  "&:hover": {
                    backgroundColor: isActive
                      ? alpha(theme.palette.primary.main, 0.18)
                      : alpha(theme.palette.primary.main, 0.08),
                  },
                  "&:active": {
                    transform: "scale(0.98)",
                  },
                })}
              >
                {item.label}
              </Button>
            );
          })}
        </Box>
      </Box>

      <div className="customer_lists_main">
        <ul ref={containerRef}>
          <>
            {loading || chatMembers.data === null || (filteredMembers.length === 0 && !showEmptyState) ? (
              <>
                {[...Array(8)].map((_, i) => (
                  <li key={i} className="member-item" style={{ pointerEvents: "none" }}>
                    <div className="member-item">
                      <div className="member-avatar">
                        <Skeleton variant="circular" width={42} height={42} />
                      </div>
                      <div className="member-info" style={{ flexGrow: 1 }}>
                        <div className="member-header">
                          <Skeleton variant="text" width="60%" height={24} />
                        </div>
                        <div className="member-message">
                          <Skeleton variant="text" width="70%" height={16} />
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </>
            ) : filteredMembers?.length > 0 ? (
              filteredMembers.map((member, index) => {
                const isSelected = selectedCustomer?.UserId === member.UserId;

                return (
                  <li key={member.UserId}>
                    <div
                      className={`member-item ${isSelected ? "active" : ""} ${
                        selectedIndex === index ? "keyboard-selected" : ""
                      }`}
                      onClick={() => onCustomerSelect(member)}
                    >
                      <div className="member-avatar">
                        {member.ProfileImageUrl ? (
                          <Avatar src={member.ProfileImageUrl as string} />
                        ) : !hasCustomerName(member) ? (
                          <Avatar
                            {...getWhatsAppAvatarConfig(getCustomerAvatarSeed(member))}
                          >
                            <User size={20} />
                          </Avatar>
                        ) : (
                          <Avatar {...member.avatarConfig} />
                        )}
                      </div>
                      <div className="member-info">
                        <div className="member-header">
                          <Typography variant="subtitle1" className="member-name">
                            {member.name}
                          </Typography>
                        </div>
                        <div className="member-message">
                          <Typography variant="body2" className="last-message">
                            {member.email || member.UserEmail || ""}
                          </Typography>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })
            ) : (
              showEmptyState && (
                <li style={{ textAlign: "center", padding: "20px" }}>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <MessageSquare size={34} style={{ color: "rgba(0,0,0,0.35)" }} />
                    <Typography variant="body2" color="textSecondary">
                      No conversations found.
                    </Typography>
                  </div>
                </li>
              )
            )}

            {loading && (chatMembers?.data?.length ?? 0) > 0 && hasMore && (
              <li
                style={{
                  textAlign: "center",
                  display: "flex",
                  justifyContent: "center",
                  padding: "10px",
                }}
              >
                <Typography variant="caption" color="textSecondary">
                  Loading more...
                </Typography>
              </li>
            )}
          </>
        </ul>
      </div>
    </div>
  );
};

export default AddConversation;
