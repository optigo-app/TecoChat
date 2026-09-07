"use client";

import React from "react";
import { Typography, Avatar, alpha, useTheme, Box, IconButton, Skeleton } from "@mui/material";
import {
  CheckCheck,
  Play,
  FileText,
  Download,
  File,
  Image as ImageIcon,
  Video as VideoIcon,
  Forward,
} from "lucide-react";
import { Emoji, EmojiStyle } from "emoji-picker-react";
import {
  getWhatsAppAvatarConfig,
  getDocumentMeta,
} from "../../utils/globalFunc";
import { formatDateTime } from "../../utils/dateUtils";
import { readMessageMemberList } from "../../API/Groups/ReadMessageMemberListApi";
import { charToUnified } from "../../utils/EmojiUtils";

interface MessageInfoMember {
  UserId?: string | number;
  UserName?: string;
  ProfileImage?: string;
  ReadAt?: string;
  EntryDate?: string;
  [key: string]: unknown;
}

interface LocalGroupData {
  members?: any[];
  [key: string]: unknown;
}

interface MessageInfoProps {
  messageInfo: any;
  localGroupData: LocalGroupData;
  auth: any;
  selectedCustomer: any;
  messages?: any;
}

const MessageInfo = ({ messageInfo, localGroupData, auth, selectedCustomer, messages = [] }: MessageInfoProps) => {
  const theme = useTheme();
  const [readMembers, setReadMembers] = React.useState<MessageInfoMember[]>([]);
  const [deliveredMembers, setDeliveredMembers] = React.useState<MessageInfoMember[]>([]);
  const [loading, setLoading] = React.useState(false);

  const fetchStatus = React.useCallback(async () => {
    if (!messageInfo?.MessageId && !messageInfo?.Id) return;
    setLoading(true);
    try {
      const res = await readMessageMemberList(messageInfo.MessageId || messageInfo.Id, auth);
      setReadMembers((res.readBy as MessageInfoMember[]) || []);
      setDeliveredMembers((res.deliveredTo as MessageInfoMember[]) || []);
    } catch (error) {
      console.error("Failed to fetch message info status:", error);
    } finally {
      setLoading(false);
    }
  }, [messageInfo?.MessageId, messageInfo?.Id, auth]);

  React.useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  if (!messageInfo) return null;

  const isOutgoing = messageInfo?.Direction === 1;

  return (
    <div className="message-info-container">
      {/* Message Preview Section */}
      <div
        className="message-preview-section"
        style={{
          padding: "24px 20px",
          display: "flex",
          justifyContent: isOutgoing ? "flex-end" : "flex-start",
          backgroundColor: "rgba(0,0,0,0.02)",
          borderBottom: "1px solid rgba(0,0,0,0.05)",
        }}
      >
        <Box
          className={`message-bubble ${isOutgoing ? "outgoing" : "incoming"}`}
          sx={{
            display: messageInfo?.MessageType === "text" ? "flex" : "block",
            flexDirection: "column",
            gap: 0.5,
            position: "relative",
            zIndex: 1,
            maxWidth: "85%",
            padding: messageInfo?.MessageType === "text" ? "10px 12px 8px 12px" : "6px",
            borderRadius: isOutgoing ? "18px 18px 0px 18px" : "18px 18px 18px 0px",
            backgroundColor: isOutgoing
              ? alpha(theme.palette.primary.main, 0.15)
              : theme.palette.background.paper,
            color: theme.palette.text.primary,
            boxShadow: `0 1px 2px ${alpha("#000", 0.1)}`,
            border: !isOutgoing ? `1px solid ${alpha(theme.palette.divider, 0.5)}` : "none",
          }}
        >
          {/* Forwarded Indicator */}
          {messageInfo?.IsForwarded === 1 && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 0.5, opacity: 0.6 }}>
              <Forward size={14} style={{ transform: "scaleX(-1)" }} />
              <Typography variant="caption" sx={{ fontStyle: "italic", fontSize: "12px" }}>
                Forwarded
              </Typography>
            </Box>
          )}

          {/* Group Sender Name */}
          {selectedCustomer?.IsGroup === 1 && !isOutgoing && (
            <Typography
              variant="caption"
              sx={{
                fontWeight: 700,
                color: theme.palette.primary.main,
                display: "block",
                mb: 0.5,
                fontSize: "12.5px",
              }}
            >
              {messageInfo.SenderInfo ||
                (messageInfo.FirstName
                  ? `${messageInfo.FirstName} ${messageInfo.LastName || ""}`
                  : messageInfo.Sender) ||
                "Member"}
            </Typography>
          )}

          {/* Reply Preview (Quoted message) */}
          {messageInfo.ContextType === 2 && (
            <div className="reply-preview-wrapper" style={{ marginBottom: "8px" }}>
              {(() => {
                const original = messages?.data?.find(
                  (m: any) => (m.MessageId || m.id) === messageInfo.ContextId
                );
                const isGenericReply =
                  !messageInfo?.ReplyContextMsg ||
                  String(messageInfo.ReplyContextMsg).trim() === "" ||
                  String(messageInfo.ReplyContextMsg).trim().toLowerCase() === "media";
                const mediaCount = Array.isArray(original?.mediaItems)
                  ? original.mediaItems.length
                  : 0;
                const originalType = original?.MessageType;
                const originalFileName =
                  original?.fileName ||
                  original?.mediaItems?.[0]?.filename ||
                  original?.mediaItems?.[0]?.fileName;

                const computedIcon = (() => {
                  if (!original) return null;
                  if (originalType === "image") return ImageIcon;
                  if (originalType === "video") return VideoIcon;
                  if (originalType === "document") return FileText;
                  return null;
                })();

                const computedReplyText = (() => {
                  if (!original) return messageInfo?.ReplyContextMsg;
                  if (!isGenericReply) return messageInfo?.ReplyContextMsg;
                  if (originalType === "image")
                    return `Media ${mediaCount > 1 ? mediaCount + " Photos" : "Photo"}`;
                  if (originalType === "video")
                    return `Media ${mediaCount > 1 ? mediaCount + " Videos" : "Video"}`;
                  if (originalType === "document") return originalFileName || "Document";
                  if (originalType === "text") return original?.Message || messageInfo?.ReplyContextMsg;
                  return messageInfo?.ReplyContextMsg;
                })();

                const computedSender =
                  original?.Direction === 1
                    ? "You"
                    : original?.SenderInfo || original?.Sender || "Member";

                return (
                  <Box
                    sx={{
                      display: "flex",
                      gap: "8px",
                      padding: "8px",
                      backgroundColor: alpha(theme.palette.primary.main, isOutgoing ? 0.12 : 0.08),
                      borderRadius: "8px",
                      borderLeft: `3px solid ${theme.palette.primary.main}`,
                      alignItems: "center",
                      minWidth: 200,
                    }}
                  >
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography
                        variant="caption"
                        sx={{
                          fontWeight: 700,
                          color: theme.palette.primary.main,
                          display: "block",
                        }}
                      >
                        {computedSender}
                      </Typography>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                        {computedIcon &&
                          React.createElement(computedIcon, { size: 14, style: { opacity: 0.7 } })}
                        <Typography variant="caption" noWrap sx={{ opacity: 0.8 }}>
                          {computedReplyText}
                        </Typography>
                      </Box>
                    </Box>
                  </Box>
                );
              })()}
            </div>
          )}

          {/* Media Type (Image/Video) */}
          {(messageInfo?.MessageType === "image" || messageInfo?.MessageType === "video") && (
            <Box sx={{ width: "100%", minWidth: 240, mb: 0.5 }}>
              {(() => {
                const mediaItems = Array.isArray(messageInfo?.mediaItems)
                  ? messageInfo.mediaItems
                  : [];
                const hasGrid = mediaItems.length > 1;

                if (hasGrid) {
                  return (
                    <Box
                      sx={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: 0.5,
                        borderRadius: "12px",
                        overflow: "hidden",
                        backgroundColor: alpha(theme.palette.text.primary, 0.05),
                      }}
                    >
                      {mediaItems.slice(0, 4).map((item: any, idx: number) => {
                        const isVideo = item.mimeType?.startsWith("video/") || item.url?.endsWith(".mp4");
                        const overflowCount = mediaItems.length - 4;
                        const showOverflow = idx === 3 && overflowCount > 0;

                        return (
                          <Box
                            key={idx}
                            sx={{
                              position: "relative",
                              aspectRatio: "1/1",
                              backgroundColor: alpha(theme.palette.text.primary, 0.1),
                            }}
                          >
                            <img
                              src={item.url}
                              alt={item.name || (isVideo ? "Video thumbnail" : "Media thumbnail")}
                              style={{ width: "100%", height: "100%", objectFit: "cover" }}
                            />
                            {isVideo && !showOverflow && (
                              <Box
                                sx={{
                                  position: "absolute",
                                  inset: 0,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  backgroundColor: "rgba(0,0,0,0.2)",
                                }}
                              >
                                <Play size={16} fill="white" color="white" />
                              </Box>
                            )}
                            {showOverflow && (
                              <Box
                                sx={{
                                  position: "absolute",
                                  inset: 0,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  backgroundColor: "rgba(0,0,0,0.45)",
                                  color: "#fff",
                                  fontWeight: 700,
                                  fontSize: "18px",
                                }}
                              >
                                +{overflowCount}
                              </Box>
                            )}
                          </Box>
                        );
                      })}
                    </Box>
                  );
                }

                return (
                  <Box
                    sx={{
                      position: "relative",
                      borderRadius: "12px",
                      overflow: "hidden",
                      width: "100%",
                      aspectRatio: "16/10",
                      backgroundColor: alpha(theme.palette.text.primary, 0.05),
                    }}
                  >
                    {messageInfo?.MessageType !== "video" && (
                      <img
                        src={
                          messageInfo?.previewUrl ||
                          messageInfo?.MediaUrl ||
                          mediaItems[0]?.url
                        }
                        alt={messageInfo?.fileName || "Media preview"}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                          display: "block",
                        }}
                      />
                    )}
                    {messageInfo?.MessageType === "video" && (
                      <div
                        style={{
                          position: "relative",
                          width: "100%",
                          height: "100%",
                          overflow: "hidden",
                          borderRadius: "8px",
                        }}
                      >
                        {/* Video Thumbnail */}
                        <video
                          src={
                            messageInfo?.previewUrl ||
                            messageInfo?.MediaUrl ||
                            mediaItems[0]?.url
                          }
                          muted
                          playsInline
                          preload="metadata"
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                          }}
                        />

                        {/* Overlay */}
                        <div
                          style={{
                            position: "absolute",
                            inset: 0,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            backgroundColor: "rgba(0,0,0,0.3)",
                          }}
                        >
                          <Box
                            sx={{
                              width: 50,
                              height: 50,
                              borderRadius: "50%",
                              backgroundColor: "rgba(255,255,255,0.9)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              color: "#000",
                            }}
                          >
                            <Play size={24} fill="#000" />
                          </Box>
                        </div>
                      </div>
                    )}
                  </Box>
                );
              })()}
            </Box>
          )}

          {/* Template Type Fallback */}
          {messageInfo?.MessageType === "template" && (
            <Box
              sx={{
                padding: "12px",
                borderRadius: "10px",
                backgroundColor: alpha(theme.palette.primary.main, 0.05),
                border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
                mb: 1,
              }}
            >
              <Typography
                variant="caption"
                sx={{
                  color: theme.palette.primary.main,
                  fontWeight: 700,
                  display: "block",
                  mb: 0.5,
                  textTransform: "uppercase",
                }}
              >
                Template Message
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.8 }}>
                {messageInfo.Message || "WhatsApp Template Message"}
              </Typography>
            </Box>
          )}

          {/* Document Type */}
          {messageInfo?.MessageType === "document" &&
            (() => {
              const name = messageInfo?.fileName || "Document";
              const meta = getDocumentMeta(name);
              const DocIcon = meta.iconName === "FileText" ? FileText : File;

              return (
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1.5,
                    width: "100%",
                    minWidth: 240,
                    padding: "10px 12px",
                    borderRadius: "10px",
                    backgroundColor: isOutgoing
                      ? alpha(theme.palette.background.default, 0.1)
                      : alpha(theme.palette.background.default, 0.5),
                    border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                  }}
                >
                  <Box
                    sx={{ color: theme.palette.primary.main, display: "flex", alignItems: "center" }}
                  >
                    {meta.iconUrl ? (
                      <img src={meta.iconUrl} alt="" style={{ width: 28, height: 28 }} />
                    ) : (
                      <DocIcon size={28} />
                    )}
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>
                      {name}
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{ opacity: 0.7, textTransform: "uppercase" }}
                    >
                      {meta.label} {messageInfo?.fileSize ? `• ${messageInfo.fileSize}` : ""}
                    </Typography>
                  </Box>
                  <IconButton size="small" sx={{ opacity: 0.7 }}>
                    <Download size={18} />
                  </IconButton>
                </Box>
              );
            })()}

          {/* Message Text / Caption */}
          {messageInfo?.Message && (
            <Typography
              variant="body2"
              sx={{
                padding: messageInfo.MessageType === "text" ? "0" : "8px 4px 4px 4px",
                fontSize: "14.5px",
                lineHeight: 1.5,
                color: theme.palette.text.primary,
                wordBreak: "break-word",
                whiteSpace: "pre-wrap",
              }}
            >
              {messageInfo.Message}
            </Typography>
          )}

          {/* Meta/Tail Info */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: 0.5,
              mt: 0.2,
              opacity: 0.8,
            }}
          >
            <Typography
              variant="caption"
              sx={{
                fontSize: "11px",
                fontWeight: 500,
                color: alpha(theme.palette.text.primary, 0.6),
              }}
            >
              {formatDateTime(messageInfo?.DateTime, "full")}
            </Typography>
            {isOutgoing && <CheckCheck size={15} color={theme.palette.primary.main} />}
          </Box>

          {/* Reactions */}
          {messageInfo?.ReactionEmojis &&
            messageInfo.ReactionEmojis !== "" &&
            messageInfo.ReactionEmojis !== "[]" && (
              <Box
                sx={{
                  position: "absolute",
                  bottom: -12,
                  left: isOutgoing ? "auto" : 8,
                  right: isOutgoing ? 8 : "auto",
                  backgroundColor: theme.palette.background.paper,
                  borderRadius: "10px",
                  padding: "2px 4px",
                  display: "flex",
                  alignItems: "center",
                  gap: 0.2,
                  boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
                  zIndex: 2,
                  border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                }}
              >
                {(() => {
                  try {
                    const reactions = JSON.parse(messageInfo.ReactionEmojis);
                    if (Array.isArray(reactions)) {
                      return reactions.map((r: any, idx: number) => {
                        const emojiChar = r?.Reaction || r?.Emoji;
                        const unified = r?.Unified || charToUnified(emojiChar);
                        return (
                          <Box key={idx} sx={{ display: "flex", alignItems: "center" }}>
                            {unified ? (
                              <Emoji unified={unified} size={14} emojiStyle={EmojiStyle.APPLE} />
                            ) : (
                              <span style={{ fontSize: "12px" }}>{emojiChar}</span>
                            )}
                          </Box>
                        );
                      });
                    }
                    return null;
                  } catch {
                    return null;
                  }
                })()}
              </Box>
            )}
        </Box>
      </div>

      {/* Status Sections */}
      <div className="status-sections-container">
        <div className="info-block status-block sections-wrapper">
          {/* Read By Section */}
          <div className="status-section">
            <div className="status-header-row">
              <Typography className="status-label">Read by</Typography>
              <span className="count-badge">{readMembers.length}</span>
            </div>

            <div className="members-list mini">
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="setting-item no-border member-item mini" style={{ cursor: "default" }}>
                    <div className="setting-left">
                      <Skeleton variant="circular" width={36} height={36} />
                      <Skeleton variant="text" width={100} height={20} />
                    </div>
                    <div className="setting-right">
                      <Skeleton variant="rounded" width={90} height={20} sx={{ borderRadius: "8px" }} />
                    </div>
                  </div>
                ))
              ) : (
                <>
                  {readMembers.map((member, idx) => (
                    <div
                      key={member.UserId || idx}
                      className="setting-item no-border member-item mini"
                    >
                      <div className="setting-left">
                        <Avatar
                          {...getWhatsAppAvatarConfig(member.UserName || "User", 36)}
                          src={member.ProfileImage}
                        />
                        <span className="member-name">{member.UserName || "User"}</span>
                      </div>
                      <div className="setting-right">
                        <Typography variant="caption" className="sub-text status-chip">
                          {member.ReadAt ? formatDateTime(member.ReadAt, "full") : ""}
                        </Typography>
                      </div>
                    </div>
                  ))}
                  {readMembers.length === 0 && !loading && (
                    <Typography className="no-status-text">
                      No one has read this message yet
                    </Typography>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="status-divider" />

          {/* Delivered To Section */}
          <div className="status-section">
            <div className="status-header-row">
              <Typography className="status-label">Delivered to</Typography>
              <span className="count-badge">{deliveredMembers.length}</span>
            </div>

            <div className="members-list mini">
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="setting-item no-border member-item mini" style={{ cursor: "default" }}>
                    <div className="setting-left">
                      <Skeleton variant="circular" width={36} height={36} />
                      <Skeleton variant="text" width={100} height={20} />
                    </div>
                    <div className="setting-right">
                      <Skeleton variant="rounded" width={90} height={20} sx={{ borderRadius: "8px" }} />
                    </div>
                  </div>
                ))
              ) : (
                <>
                  {deliveredMembers.map((member, idx) => (
                    <div
                      key={member.UserId || idx}
                      className="setting-item no-border member-item mini"
                    >
                      <div className="setting-left">
                        <Avatar
                          {...getWhatsAppAvatarConfig(member.UserName || "User", 36)}
                          src={member.ProfileImage}
                        />
                        <span className="member-name">{member.UserName || "User"}</span>
                      </div>
                      <div className="setting-right">
                        <Typography variant="caption" className="sub-text status-chip">
                          {member.EntryDate ? formatDateTime(member.EntryDate, "full") : "Delivered"}
                        </Typography>
                      </div>
                    </div>
                  ))}
                  {deliveredMembers.length === 0 && !loading && (
                    <Typography className="no-status-text">Delivered to all members</Typography>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MessageInfo;
