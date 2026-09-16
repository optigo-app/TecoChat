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
  Chip,
  CircularProgress,
  Popover,
  Divider,
} from "@mui/material";
import { X, ArrowLeft, ArrowRight, Check, Smile, User, ChevronRight } from "lucide-react";
import dynamic from "next/dynamic";
const EmojiPicker = dynamic(() => import("emoji-picker-react"), { ssr: false });
import "./AddConversation.scss";
import "./CreateGroup.scss";
import {
  getCustomerAvatarSeed,
  getCustomerDisplayName,
  getWhatsAppAvatarConfig,
  hasCustomerName,
} from "../../utils/globalFunc";
import { fetchCustomerLists } from "../../API/CustomerLists/CustomerLists";
import { LoginContext, useLoginContext } from "../../contexts/LoginData";
import { createGroupApi } from "../../API/Groups/CreateGroupApi";
import { toast } from "react-hot-toast";
import ProfileAvatarUpload from "../ReusableComponent/ProfileAvatarUpload";
import GroupPermissions from "../CustomerDetails/GroupPermissions";

interface CreateGroupProps {
  onBack: () => void;
  onClose: () => void;
  onContinue?: (data: any) => void;
}

interface ChatMember {
  UserId: string | number;
  UserName?: string;
  UserEmail?: string;
  email?: string;
  ProfileImageUrl?: string;
  name: string;
  avatarConfig: ReturnType<typeof getWhatsAppAvatarConfig>;
  [key: string]: unknown;
}

interface ChatMembersState {
  data: ChatMember[];
  total: number;
}

const CreateGroup = ({ onBack, onClose, onContinue }: CreateGroupProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [chatMembers, setChatMembers] = useState<ChatMembersState>({
    data: [],
    total: 0,
  });
  const [selectedMembers, setSelectedMembers] = useState<ChatMember[]>([]);
  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState<"forward" | "backward">("backward");
  const [groupName, setGroupName] = useState("");
  const [groupNameTouched, setGroupNameTouched] = useState(false);
  const [groupProfileUrl, setGroupProfileUrl] = useState("");
  const [selectedProfileFile, setSelectedProfileFile] = useState<File | null>(
    null
  );
  const [permissions, setPermissions] = useState({
    editGroupSettings: true,
    sendMessages: true,
    addOtherMembers: true,
    AllowDeleteForAll: true,
    approveNewMembers: false,
    inviteToGroup: false,
    editGroupAdmins: false,
  });
  const [emojiAnchorEl, setEmojiAnchorEl] = useState<HTMLElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const containerRef = useRef<HTMLUListElement>(null);
  const groupNameInputRef = useRef<HTMLDivElement>(null);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const pageSize = 100;
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { auth } = useLoginContext();

  const transformMemberData = useCallback((items: any[]): ChatMember[] => {
    return (
      items?.map((item) => {
        const name = item.UserName || getCustomerDisplayName(item);
        return {
          ...item,
          UserId: item.UserId,
          name,
          email: item.UserEmail || item.email || "",
          avatarConfig: getWhatsAppAvatarConfig(getCustomerAvatarSeed(item)),
        };
      }) || []
    );
  }, []);

  const loadMembers = useCallback(
    async (page = 1, reset = false, search: string | null = null) => {
      if (loading || (!reset && !hasMore)) return;
      if (!auth?.token || !auth?.userId) return;

      setLoading(true);
      try {
        const searchToUse = search !== null ? search : searchTerm;
        const response = await fetchCustomerLists(
          page,
          pageSize,
          searchToUse,
          auth
        );
        const transformedData = transformMemberData(response.data);

        setChatMembers((prev) => ({
          data: reset
            ? transformedData
            : [...(prev.data || []), ...transformedData],
          total: response.total,
        }));

        const moreAvailable =
          response?.hasMore ?? transformedData.length > 0;
        setHasMore(moreAvailable);
        if (moreAvailable) setCurrentPage(page);
      } catch (error) {
        console.error("Error loading members:", error);
      } finally {
        setLoading(false);
      }
    },
    [loading, hasMore, auth, searchTerm, transformMemberData]
  );

  useEffect(() => {
    loadMembers(1, true);
  }, []);

  const debouncedSearch = useCallback(
    (value: string) => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
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
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
      loadMembers(1, true, "");
    } else {
      debouncedSearch(value);
    }
  };

  const scrollToSelectedIndex = useCallback((index: number) => {
    if (containerRef.current && index >= 0) {
      const container = containerRef.current;
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

  const filteredMembers = chatMembers?.data?.filter((member) => {
    const myId = Number(auth?.id ?? auth?.userId);
    const isSelected = selectedMembers.some(
      (sm) => sm.UserId === member.UserId
    );

    const searchLower = searchTerm.toLowerCase();
    const matchesName = member.name.toLowerCase().includes(searchLower);
    const matchesEmail = (member.email || "").toLowerCase().includes(searchLower);

    const isSelf = myId === Number(member?.UserId ?? (member as any)?.id);

    return !isSelf && !isSelected && (matchesName || matchesEmail);
  });

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (step !== 1 || !filteredMembers?.length) return;

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
        toggleMemberSelection(filteredMembers[selectedIndex]);
      }
    }
  };

  useEffect(() => {
    setSelectedIndex(-1);
  }, [searchTerm, chatMembers, step]);

  const toggleMemberSelection = (member: ChatMember) => {
    setSelectedMembers((prev) => {
      const isSelected = prev.find((m) => m.UserId === member.UserId);
      if (isSelected) {
        return prev.filter((m) => m.UserId !== member.UserId);
      }
      return [...prev, member];
    });
  };

  const removeMember = (memberId: string | number) => {
    setSelectedMembers((prev) => prev.filter((m) => m.UserId !== memberId));
  };

  const handleSelectAll = (isSelectAll: boolean) => {
    if (isSelectAll) {
      const myId = Number(auth?.id ?? auth?.userId);
      const selectableMembers =
        chatMembers?.data?.filter(
          (member) => Number(member?.UserId ?? (member as any)?.id) !== myId
        ) || [];
      setSelectedMembers(selectableMembers);
    } else {
      setSelectedMembers([]);
    }
  };

  const handleScroll = useCallback(() => {
    if (!containerRef.current || loading || !hasMore) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    if (scrollTop + clientHeight >= scrollHeight - 80) {
      loadMembers(currentPage + 1, false);
    }
  }, [loading, hasMore, currentPage, loadMembers]);

  const handleBack = () => {
    setDirection("backward");
    if (step === 3) {
      setStep(2);
    } else if (step === 2) {
      setStep(1);
    } else {
      setSelectedProfileFile(null);
      setGroupProfileUrl("");
      onBack();
    }
  };

  const handleEmojiClick = (event: React.MouseEvent<HTMLElement>) => {
    setEmojiAnchorEl(event.currentTarget);
  };

  const handleEmojiSelect = (emojiData: { emoji: string }) => {
    const input = groupNameInputRef.current?.querySelector(
      "input, textarea"
    ) as HTMLInputElement | HTMLTextAreaElement | null;
    if (input) {
      const start = input.selectionStart ?? 0;
      const end = input.selectionEnd ?? 0;
      const text = groupName;
      const before = text.substring(0, start);
      const after = text.substring(end);
      const newValue = (before + emojiData.emoji + after).slice(0, 50);
      setGroupName(newValue);

      setTimeout(() => {
        const newPos = start + emojiData.emoji.length;
        input.setSelectionRange(newPos, newPos);
        input.focus();
      }, 0);
    } else {
      setGroupName((prev) => (prev + emojiData.emoji).slice(0, 50));
    }
    setEmojiAnchorEl(null);
  };

  const handlePermissionChange = (name: string, value: boolean) => {
    if (name === "inviteToGroup" || name === "approveNewMembers") {
      toast(`${name} — coming soon!`);
      return;
    }
    setPermissions((prev) => ({ ...prev, [name]: value }));
  };

  const handleFinalContinue = async () => {
    if (loading) return;

    if (!groupName.trim()) {
      setGroupNameTouched(true);
      (
        groupNameInputRef.current?.querySelector(
          "input, textarea"
        ) as HTMLInputElement | null
      )?.focus();
      toast.error("Group Subject is required");
      return;
    }

    if (groupName.length > 50) {
      toast.error("Group name cannot exceed 50 characters");
      return;
    }

    if (selectedMembers.length === 0) {
      toast.error("At least one member is required to create a group");
      return;
    }

    setLoading(true);
    try {
      const myId = Number(auth?.id ?? auth?.userId);

      let uploadedProfileUrl = "";
      if (selectedProfileFile) {
        try {
          const { uploadMediaAPi } = await import(
            "../../API/FileUpload/uploadHelpers"
          );
          const uploadedFiles = await uploadMediaAPi({
            folderName: "tecochat/profileImage",
            files: [selectedProfileFile],
            onProgress: (progress) => {
              console.log("Upload progress:", progress);
            },
          });

          if (
            uploadedFiles &&
            Array.isArray(uploadedFiles) &&
            uploadedFiles.length > 0
          ) {
            const uploadedFile = uploadedFiles[0];
            uploadedProfileUrl =
              uploadedFile?.FileUrl ||
              uploadedFile?.fileUrl ||
              uploadedFile?.Url ||
              uploadedFile?.url ||
              uploadedFile?.path;
          }
        } catch (uploadError) {
          console.error("Error uploading profile image:", uploadError);
          toast.error("Failed to upload group icon");
          setLoading(false);
          return;
        }
      }

      const members = [
        { UserId: myId, IsAdmin: 1 },
        ...selectedMembers.map((member) => ({
          UserId: Number(member.UserId || (member as any)?.id),
          IsAdmin: 0,
        })),
      ];

      const response = await createGroupApi(auth, {
        userId: myId,
        groupName: groupName.trim(),
        groupDesc: "",
        groupMembers: members,
        groupProfile: uploadedProfileUrl || "",
        permissions: permissions,
      });

      const rd = response?.Data?.rd?.[0] ?? response?.rd?.[0];
      const stat = rd?.stat;
      const statMsg = rd?.stat_msg;
      if (stat === 1 || response?.success || response?.Status === "200") {
        toast.success("Group created successfully");
        if (onContinue) {
          onContinue({
            response,
            name: groupName,
            members: selectedMembers,
            permissions,
          });
        }
        if (onClose) onClose();
      } else {
        toast.error(statMsg || response?.message || "Failed to create group");
      }
    } catch (error) {
      console.error("Create Group Error:", error);
      toast.error("Internal server error occurred");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  useEffect(() => {
    return () => {
      if (groupProfileUrl && groupProfileUrl.startsWith("blob:")) {
        URL.revokeObjectURL(groupProfileUrl);
      }
    };
  }, [groupProfileUrl]);

  return (
    <div className="customer_lists_mainDiv_2 create_group_container">
      <div className="customer_lists_header">
        <Box className="add_conv_box">
          <IconButton onClick={handleBack} size="small" className="add_conv">
            <ArrowLeft size={20} />
          </IconButton>
          <Typography variant="h6" className="header_title">
            {step === 1
              ? "Add group members"
              : step === 2
              ? "New Group"
              : "Group permissions"}
          </Typography>
        </Box>
        {step === 1 && (
          <IconButton
            onClick={() => {
              setSelectedProfileFile(null);
              setGroupProfileUrl("");
              onClose();
            }}
            size="small"
            className="add_conv"
          >
            <X size={20} />
          </IconButton>
        )}
      </div>

      <div className={`steps-container step-${step} direction-${direction}`}>
        {step === 1 ? (
          <div className={`step-content step-1 ${direction}`} key={1}>
            <div className="selected_members_section">
              {selectedMembers.length > 0 && (
                <div className="selected_chips_container">
                  {selectedMembers.map((member) => (
                    <Chip
                      key={member.UserId}
                      avatar={<Avatar {...member.avatarConfig} />}
                      label={member.name}
                      onDelete={() => removeMember(member.UserId)}
                      className="member_chip"
                    />
                  ))}
                </div>
              )}
              <div className="customer_lists_search">
                <TextField
                  fullWidth
                  placeholder="Type contact name"
                  variant="standard"
                  size="small"
                  value={searchTerm}
                  onChange={handleSearchChange}
                  onKeyDown={handleKeyDown}
                  slotProps={{
                    input: {
                      disableUnderline: true,
                      endAdornment: (
                        <InputAdornment position="end">
                          {searchTerm && (
                            <IconButton
                              size="small"
                              onClick={() => {
                                setSearchTerm("");
                                loadMembers(1, true, "");
                              }}
                            >
                              <X size={18} />
                            </IconButton>
                          )}
                          <Button
                            size="small"
                            onClick={() =>
                              handleSelectAll(selectedMembers.length === 0)
                            }
                            sx={{
                              textTransform: "none",
                              fontSize: "12px",
                              fontWeight: 600,
                              ml: 1,
                              minWidth: "fit-content",
                            }}
                          >
                            {selectedMembers.length > 0
                              ? "Remove All"
                              : "Select All"}
                          </Button>
                        </InputAdornment>
                      ),
                    },
                  }}
                />
              </div>
            </div>

            <div className="customer_lists_main">
              <ul ref={containerRef}>
                {filteredMembers?.map((member, index) => {
                  const isSelected = selectedMembers.some(
                    (m) => m.UserId === member.UserId
                  );
                  const isKeyboardSelected = index === selectedIndex;
                  return (
                    <li
                      key={member.UserId}
                      onClick={() => toggleMemberSelection(member)}
                      className="member-list-item"
                    >
                      <div
                        className={`member-item ${isSelected ? "selected" : ""} ${
                          isKeyboardSelected ? "keyboard-selected" : ""
                        }`}
                      >
                        <div className="member-avatar">
                          {member.ProfileImageUrl ? (
                            <Avatar src={member.ProfileImageUrl as string} />
                          ) : !hasCustomerName(member) ? (
                            <Avatar
                              {...getWhatsAppAvatarConfig(
                                getCustomerAvatarSeed(member)
                              )}
                            >
                              <User size={20} />
                            </Avatar>
                          ) : (
                            <Avatar {...member.avatarConfig} />
                          )}
                        </div>
                        <div className="member-info">
                          <Typography variant="subtitle1" className="member-name">
                            {member.name}
                          </Typography>
                          <Typography
                            variant="body2"
                            className="member-email"
                            sx={{ color: "text.secondary", fontSize: "12px" }}
                          >
                            {member.email}
                          </Typography>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>

            {selectedMembers.length > 0 && (
              <Box className="continue_button_container">
                <Button
                  variant="contained"
                  className="continue_fab"
                  onClick={() => {
                    setDirection("forward");
                    setStep(2);
                  }}
                >
                  <ArrowRight size={20} />
                </Button>
              </Box>
            )}
          </div>
        ) : step === 2 ? (
          <div className={`step-content step-2 ${direction}`} key={2}>
            <div className="group_info_step">
              <div className="icon_upload_section">
                <ProfileAvatarUpload
                  size={120}
                  currentImageUrl={groupProfileUrl}
                  avatarSeed={groupName || "New Group"}
                  showOverlay={true}
                  overlayText="Add group icon"
                  onImageSelected={(file, previewUrl) => {
                    setSelectedProfileFile(file);
                    setGroupProfileUrl(previewUrl);
                  }}
                  onUploadError={(error) => {
                    console.error("Image selection failed:", error);
                    toast.error("Failed to select group icon");
                  }}
                  onRemoveComplete={() => {
                    setSelectedProfileFile(null);
                    setGroupProfileUrl("");
                  }}
                  className="group-icon-upload"
                  folderName="tecochat/profileImage"
                />
              </div>

              <div className="group_name_section">
                <TextField
                  ref={groupNameInputRef as any}
                  fullWidth
                  multiline
                  maxRows={3}
                  placeholder="Group Subject"
                  variant="standard"
                  value={groupName}
                  onChange={(e) => {
                    setGroupName(e.target.value.slice(0, 50));
                    if (!groupNameTouched) setGroupNameTouched(true);
                  }}
                  onBlur={() => setGroupNameTouched(true)}
                  error={groupNameTouched && !groupName.trim()}
                  helperText={
                    groupNameTouched && !groupName.trim()
                      ? "Group Subject is required"
                      : `${groupName.length}/50`
                  }
                  slotProps={{
                    input: {
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            onClick={handleEmojiClick}
                            size="small"
                            sx={{ mb: 0.5 }}
                          >
                            <Smile size={20} />
                          </IconButton>
                        </InputAdornment>
                      ),
                    },
                  }}
                  sx={{
                    "& .MuiInput-root": {
                      fontSize: "16px",
                      pb: 0.5,
                      "&:before": { borderBottomColor: "var(--color-primary)" },
                      "&:hover:not(.Mui-disabled):before": {
                        borderBottomColor: "var(--color-primary)",
                      },
                      "&:after": { borderBottomColor: "var(--color-primary)" },
                    },
                    "& .MuiFormHelperText-root": {
                      textAlign: "right",
                      marginRight: 0,
                    },
                  }}
                />

                <Popover
                  open={Boolean(emojiAnchorEl)}
                  anchorEl={emojiAnchorEl}
                  onClose={() => setEmojiAnchorEl(null)}
                  anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
                >
                  <EmojiPicker onEmojiClick={handleEmojiSelect} />
                </Popover>
              </div>

              <Divider sx={{ width: "100%", my: 2, borderColor: "var(--color-wa-modal-header-border)" }} />

              <div
                className="group_permissions_section"
                onClick={() => {
                  setDirection("forward");
                  setStep(3);
                }}
                style={{ cursor: "pointer" }}
              >
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    px: 2,
                    justifyContent: "space-between",
                    width: "100%",
                  }}
                >
                  <Typography variant="subtitle2" color="textSecondary">
                    Group permissions
                  </Typography>
                  <IconButton size="small">
                    <ChevronRight />
                  </IconButton>
                </Box>
              </div>

              <Divider sx={{ width: "100%", my: 2, borderColor: "var(--color-wa-modal-header-border)" }} />

              <div className="selected_summary">
                <Typography
                  variant="subtitle2"
                  color="textSecondary"
                  sx={{ px: 2, mb: 1 }}
                >
                  MEMBERS: {selectedMembers.length}
                </Typography>
                <div className="summary_member_list">
                  {selectedMembers.map((member) => (
                    <div
                      key={member.UserId}
                      className="summary-member-item"
                    >
                      <div className="member-avatar">
                        <Avatar {...member.avatarConfig} />
                      </div>
                      <div className="member-info">
                        <Typography
                          variant="subtitle1"
                          className="member-name"
                        >
                          {member.name}
                        </Typography>
                        <Typography
                          variant="body2"
                          className="member-email"
                          sx={{ color: "text.secondary", fontSize: "12px" }}
                        >
                          {member.email}
                        </Typography>
                      </div>
                      <IconButton
                        size="small"
                        onClick={() => removeMember(member.UserId)}
                      >
                        <X size={14} />
                      </IconButton>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <Box className="continue_button_container">
              <Button
                variant="contained"
                className="continue_fab finalize"
                disabled={loading}
                onClick={handleFinalContinue}
              >
                {loading ? (
                  <CircularProgress size={24} color="inherit" />
                ) : (
                  <Check size={20} />
                )}
              </Button>
            </Box>
          </div>
        ) : (
          <div className={`step-content step-3 ${direction}`} key={3}>
            <GroupPermissions
              permissions={permissions}
              onPermissionChange={handlePermissionChange}
              onBack={() => {
                setDirection("backward");
                setStep(2);
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default CreateGroup;
