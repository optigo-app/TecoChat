"use client";

import { useCallback } from "react";
import { MSG, type MsgAction } from "./conversationReducer";
import { UI, type UIAction } from "./uiReducer";
import { getLocalTime } from "./messageHelpers";
import { emitInternalMessageSend } from "../../../socket";
import { forwardMessageApi } from "../../../API/SendMessage/forwardMessageApi";
import { showToast } from "../../../utils/toastHelper";
import type { AuthData } from "../../../context/LoginData";
import type { ChatMessage } from "../../../types/message";
import type { ConversationListEntry } from "../../../types/conversation";

interface UseForwardMessageProps {
  auth: AuthData | null;
  selectedCustomer: ConversationListEntry | null;
  uiState: { forwardMessage: ChatMessage | null };
  dispatchUI: React.Dispatch<UIAction>;
  dispatchMsg: React.Dispatch<MsgAction>;
}

export function useForwardMessage({
  auth,
  selectedCustomer,
  uiState,
  dispatchUI,
  dispatchMsg,
}: UseForwardMessageProps) {
  const handleForward = useCallback(
    (message: ChatMessage, event?: React.MouseEvent) => {
      if (event) event.stopPropagation();
      dispatchUI({ type: UI.SET_FORWARD, value: message });
      dispatchUI({
        type: UI.SET_FORWARD_ANCHOR,
        value: (event?.currentTarget as HTMLElement) ?? null,
      });
    },
    [dispatchUI]
  );

  const handleCloseForward = useCallback(() => {
    dispatchUI({ type: UI.SET_FORWARD, value: null });
    dispatchUI({ type: UI.SET_FORWARD_ANCHOR, value: null });
  }, [dispatchUI]);

  const handleSendForward = useCallback(
    async (selectedContactsArr: Array<{
      ConversationId?: string | number;
      UserId?: string | number;
      id?: string | number;
      DisplayName?: string;
      UserName?: string;
      Type?: string;
      ProfileImageUrl?: string;
    }> = []) => {
      const fwdMsg = uiState.forwardMessage;
      if (!fwdMsg || !auth || selectedContactsArr.length === 0) {
        dispatchUI({ type: UI.SET_FORWARD, value: null });
        dispatchUI({ type: UI.SET_FORWARD_ANCHOR, value: null });
        return;
      }

      const conversationIdsArr: (string | number)[] = [];
      const userIdsArr: (string | number)[] = [];

      for (const contact of selectedContactsArr) {
        if (contact?.ConversationId) {
          conversationIdsArr.push(contact.ConversationId);
        } else if (contact?.UserId || contact?.id) {
          userIdsArr.push(contact.UserId || contact.id!);
        }
      }

      const getAttachmentIds = () => {
        if ((fwdMsg as any).ReplyToAttachmentId) return String((fwdMsg as any).ReplyToAttachmentId);
        if (Array.isArray(fwdMsg?.mediaItems) && fwdMsg.mediaItems.length) {
          const ids = fwdMsg.mediaItems.map((a: any) => a?.attachmentId || a?.Id).filter(Boolean);
          if (ids.length) return ids.join(",");
        }
        let att = (fwdMsg as any)?.Attachments;
        if (att) {
          if (typeof att === "string") {
            try { att = JSON.parse(att); } catch { att = null; }
          }
          if (Array.isArray(att) && att.length) {
            const ids = att.map((a: any) => a?.Id || a?.id).filter(Boolean);
            if (ids.length) return ids.join(",");
          }
        }
        return null;
      };

      try {
        const msgId = (fwdMsg as any).MessageId || (fwdMsg as any).Id;
        const response = await forwardMessageApi(
          auth,
          {
            MessageId: msgId ?? null,
            ConversationIds: conversationIdsArr.join(",") || null,
            UserIds: userIdsArr.join(",") || null,
            ForwardedAttachmentIds: getAttachmentIds(),
          },
          "Forward ( Forward Message To Multiple )"
        );

        if (response?.success || response?.Status === "200") {
          showToast("Message forwarded successfully", "success");

          const rd = response?.Data?.rd?.[0] || (response as any)?.rd?.[0];
          if (rd?.ForwardedMessages) {
            try {
              const forwarded = JSON.parse(rd.ForwardedMessages);
              if (Array.isArray(forwarded)) {
                // Contacts without ConversationId (rd1/employees) — matched by order
                // since the API response only returns the new ConversationId, not UserId
                const userIdContacts = selectedContactsArr.filter(
                  (c) => !c.ConversationId || Number(c.ConversationId) === 0
                );
                let userIdMatchIdx = 0;

                forwarded.forEach((fwdData: any) => {
                  if (!fwdData) return;

                  const { time, date, dateTime } = getLocalTime();
                  const convId = fwdData.ConversationId;
                  const realMsgId = fwdData.MessageId;
                  const isMedia = ["image", "video", "document"].includes(fwdMsg?.MessageType || "");
                  let mediaItems = fwdMsg?.mediaItems || [];
                  let previewUrl = fwdMsg?.previewUrl || null;
                  let fileName = (fwdMsg as any)?.fileName || null;
                  let fileType = (fwdMsg as any)?.fileType || null;

                  if ((fwdMsg as any).ReplyToAttachmentId && Array.isArray(mediaItems)) {
                    const single = mediaItems.find(
                      (i: any) => i.attachmentId === (fwdMsg as any).ReplyToAttachmentId || i.Id === (fwdMsg as any).ReplyToAttachmentId
                    );
                    if (single) {
                      mediaItems = [single];
                      previewUrl = single.url || previewUrl;
                      fileName = single.filename || fileName;
                      fileType = single.mimeType || fileType;
                    }
                  }

                  // Match the forwarded entry to the original contact.
                  // For contacts with existing ConversationId, match by ConversationId.
                  // For rd1 contacts (ConversationId=0), the API returns a NEW ConversationId,
                  // so we match by order among the unmatched userId contacts.
                  let matchedContact = selectedContactsArr.find(
                    (c) => c.ConversationId && Number(c.ConversationId) === Number(convId)
                  );
                  if (!matchedContact && userIdMatchIdx < userIdContacts.length) {
                    matchedContact = userIdContacts[userIdMatchIdx++];
                  }

                  let rawReceiverId = matchedContact?.UserId ?? matchedContact?.id ?? null;
                  let receiverId: any = rawReceiverId;
                  if (typeof rawReceiverId === "string") {
                    if (rawReceiverId.trim().startsWith("[")) {
                      try { receiverId = JSON.parse(rawReceiverId); } catch { receiverId = []; }
                    } else {
                      receiverId = Number(rawReceiverId);
                    }
                  }

                  if (selectedCustomer?.ConversationId && Number(convId) === Number(selectedCustomer.ConversationId)) {
                    dispatchMsg({
                      type: MSG.UPSERT,
                      id: realMsgId,
                      msg: {
                        Id: realMsgId,
                        MessageId: realMsgId,
                        SenderId: auth?.id as any,
                        ConversationId: convId,
                        Message: fwdMsg?.Message || (isMedia ? "" : "Forwarded Message"),
                        Status: 1,
                        Direction: 1,
                        DateTime: dateTime,
                        MessageType: (fwdMsg?.MessageType || "text") as any,
                        IsForwarded: true,
                        mediaItems,
                        previewUrl,
                        fileName,
                        fileType,
                        Time: time,
                        Date: date,
                      } as any,
                    });
                  }

                  emitInternalMessageSend({
                    Id: realMsgId,
                    ReceiverId: receiverId,
                    Type: fwdData.Type,
                    ufcc: (auth as any)?.ufcc,
                    SenderId: auth?.id as any,
                    ConversationId: convId,
                    Message: fwdMsg?.Message || (isMedia ? "" : "Forwarded Message"),
                    MessageId: realMsgId,
                    Status: 1,
                    MessageStatus: 1,
                    Direction: 0,
                    DateTime: dateTime,
                    MessageType: fwdMsg?.MessageType || "text",
                    IsForwarded: true,
                    mediaItems,
                    previewUrl,
                    fileName,
                    fileType,
                    Time: time,
                    Date: date,
                    SenderName: (auth as any)?.username || (auth as any)?.name,
                    FirstName: (auth as any)?.firstName || (auth as any)?.FirstName || (auth as any)?.firstname,
                    LastName: (auth as any)?.lastName || (auth as any)?.LastName || (auth as any)?.lastname,
                    SenderEmail: (auth as any)?.email,
                    SenderProfilePicture: (auth as any)?.ProfileImageUrl || (auth as any)?.profilePicture || (auth as any)?.profileImage || "",
                    ProfileImageUrl: (auth as any)?.ProfileImageUrl || (auth as any)?.profileImage || (auth as any)?.AvatarUrl || "",
                    ProfileImage: (auth as any)?.ProfileImage || (auth as any)?.profileImage || (auth as any)?.AvatarUrl || "",
                    RecieverName: matchedContact?.UserName || matchedContact?.DisplayName || "",
                    ConversationName: matchedContact?.UserName || matchedContact?.DisplayName || "",
                    UserName: matchedContact?.UserName || matchedContact?.DisplayName || "",
                    MemberName: matchedContact?.UserName || matchedContact?.DisplayName || "",
                    IsGroup: matchedContact?.Type === "Group" ? 1 : 0,
                  } as any);

                  // Ensure the conversation appears in the conversation list
                  // (handles cases where the target conversation isn't loaded yet,
                  //  e.g. forwarding to an employee from rd1 who has no existing chat)
                  const fwdMessageText = fwdMsg?.Message || (isMedia ? "" : "Forwarded Message");
                  const contactName = matchedContact?.UserName || matchedContact?.DisplayName || "";
                  window.dispatchEvent(
                    new CustomEvent("UPDATE_CONVERSATION_ITEM", {
                      detail: {
                        ConversationId: convId,
                        ConversationName: contactName,
                        name: contactName,
                        UserName: contactName,
                        MemberName: contactName,
                        DisplayName: contactName,
                        Message: fwdMessageText,
                        LastMessage: fwdMessageText,
                        MessageType: fwdMsg?.MessageType || "text",
                        LastMessageType: fwdMsg?.MessageType || "text",
                        LastMessageStatus: 1,
                        LastMessageDirection: 1,
                        LastMessageId: realMsgId,
                        LastMessageDate: dateTime,
                        LastUpdatedDate: dateTime,
                        DateTime: dateTime,
                        SenderId: auth?.id,
                        ReceiverId: receiverId,
                        IsGroup: matchedContact?.Type === "Group" ? 1 : 0,
                        ProfileImageUrl: matchedContact?.ProfileImageUrl || "",
                        UnreadCount: 0,
                        unreadCount: 0,
                        isStatusChange: false,
                      },
                    })
                  );
                });
              }
            } catch (err) {
              console.error("ForwardedMessages parse error:", err);
            }
          }
        } else {
          showToast(response?.Message || "Failed to forward message", "error");
        }
      } catch (err) {
        console.error("Forward error:", err);
        showToast("Error forwarding message", "error");
      }

      dispatchUI({ type: UI.SET_FORWARD, value: null });
      dispatchUI({ type: UI.SET_FORWARD_ANCHOR, value: null });
    },
    [auth, selectedCustomer, uiState.forwardMessage, dispatchUI, dispatchMsg]
  );

  return { handleForward, handleCloseForward, handleSendForward };
}
