"use client";

import { MessageCircle, User, Shield, UserMinus } from "lucide-react";
import WhatsAppMenu from "../ReusableComponent/WhatsAppMenu";
import ConfirmationDialog from "../ReusableComponent/ConfirmationDialog";

interface GroupMember {
  Name?: string;
  IsAdmin?: number | boolean;
  [key: string]: unknown;
}

interface ConfirmationModalState {
  isOpen: boolean;
  member: GroupMember | null;
  actionType: string | null;
}

interface LocalGroupData {
  createdBy?: string;
  [key: string]: unknown;
}

interface MemberActionsProps {
  memberMenuAnchorEl: HTMLElement | null;
  menuPosition: { top: number; left: number } | null;
  onCloseMenu: () => void;
  confirmationModal: ConfirmationModalState;
  isCurrentUserAdmin: boolean | undefined;
  localGroupData: LocalGroupData;
  onMenuAction: (action: string, context?: any) => void;
  onConfirmAction: () => void;
  onCloseConfirmation: () => void;
}

const MemberActions = ({
  memberMenuAnchorEl,
  menuPosition,
  onCloseMenu,
  confirmationModal,
  isCurrentUserAdmin,
  localGroupData,
  onMenuAction,
  onConfirmAction,
  onCloseConfirmation,
}: MemberActionsProps) => {
  const memberName = confirmationModal.member?.Name?.split(" ")[0] || "member";
  const fullMemberName = confirmationModal.member?.Name || "member";

  return (
    <>
      <WhatsAppMenu
        anchorEl={memberMenuAnchorEl}
        open={Boolean(memberMenuAnchorEl) || Boolean(menuPosition)}
        onClose={onCloseMenu}
        sx={{ px: 1 }}
        anchorReference={menuPosition ? "anchorPosition" : "anchorEl"}
        anchorPosition={menuPosition ?? undefined}
        items={[
          {
            label: `Message ${memberName}`,
            action: "messageMember",
            icon: <MessageCircle size={18} />,
          },
          {
            label: `View ${memberName === "member" ? "contact" : memberName}`,
            action: "viewMember",
            icon: <User size={18} />,
          },
          ...(isCurrentUserAdmin
            ? [
                ...(confirmationModal.member?.Name !== localGroupData.createdBy
                  ? [
                      {
                        label: confirmationModal.member?.IsAdmin
                          ? "Remove as admin"
                          : "Make group admin",
                        action: confirmationModal.member?.IsAdmin
                          ? "removeAdmin"
                          : "makeAdmin",
                        icon: <Shield size={18} />,
                      },
                      {
                        label: `Remove ${fullMemberName}`,
                        action: "removeMember",
                        danger: true,
                        icon: <UserMinus size={18} />,
                      },
                    ]
                  : []),
              ]
            : []),
        ]}
        onAction={onMenuAction}
        transformOrigin={
          menuPosition
            ? { horizontal: "left", vertical: "top" }
            : { horizontal: "right", vertical: "top" }
        }
        anchorOrigin={
          menuPosition
            ? { horizontal: "left", vertical: "bottom" }
            : { horizontal: "right", vertical: "bottom" }
        }
      />

      <ConfirmationDialog
        isOpen={confirmationModal.isOpen && Boolean(confirmationModal.member)}
        onClose={onCloseConfirmation}
        onConfirm={onConfirmAction}
        title={
          confirmationModal.actionType === "roleUpdate"
            ? confirmationModal.member?.IsAdmin
              ? "Remove Admin?"
              : "Make Admin?"
            : confirmationModal.actionType === "remove"
            ? "Remove Participant?"
            : confirmationModal.actionType === "clearChat"
            ? "Clear Chat?"
            : confirmationModal.actionType === "adminCannotLeave"
            ? "Cannot Leave Group"
            : confirmationModal.actionType === "deleteGroup"
            ? "Delete Group?"
            : "Exit Group?"
        }
        description={
          confirmationModal.actionType === "roleUpdate"
            ? confirmationModal.member?.IsAdmin
              ? `Are you sure you want to remove ${fullMemberName} from group admins?`
              : `Are you sure you want to make ${fullMemberName} a group admin?`
            : confirmationModal.actionType === "remove"
            ? `Are you sure you want to remove ${fullMemberName} from this group?`
            : confirmationModal.actionType === "clearChat"
            ? "Are you sure you want to clear all messages in this chat?"
            : confirmationModal.actionType === "adminCannotLeave"
            ? "You cannot leave the group because you are the only administrator. Please assign another admin before leaving."
            : confirmationModal.actionType === "deleteGroup"
            ? "Are you sure you want to delete this group conversation? This will remove the conversation from your chat list."
            : "Are you sure you want to exit this group?"
        }
        confirmText={
          confirmationModal.actionType === "roleUpdate"
            ? confirmationModal.member?.IsAdmin
              ? "Remove admin"
              : "Make admin"
            : confirmationModal.actionType === "remove"
            ? "Remove"
            : confirmationModal.actionType === "clearChat"
            ? "Clear"
            : confirmationModal.actionType === "adminCannotLeave"
            ? "OK"
            : confirmationModal.actionType === "deleteGroup"
            ? "Delete"
            : "Exit"
        }
        variant={
          ["remove", "clearChat", "exitGroup", "deleteGroup"].includes(
            confirmationModal.actionType as string
          )
            ? "danger"
            : "primary"
        }
        showCancel={confirmationModal.actionType !== "adminCannotLeave"}
      />
    </>
  );
};

export default MemberActions;
