"use client";

import {
  Typography,
  Divider,
  Box,
} from "@mui/material";
import {
  Edit,
  MessageSquare,
  UserPlus,
  UserCheck,
  ChevronRight,
  UserStar,
  Link2,
  Trash,
} from "lucide-react";
import IOSSwitch from "../ReusableComponent/IOSSwitch";

interface GroupPermissionsData {
  editGroupSettings?: boolean;
  sendMessages?: boolean;
  addOtherMembers?: boolean;
  AllowDeleteForAll?: boolean;
  approveNewMembers?: boolean;
  inviteToGroup?: boolean;
  editGroupAdmins?: boolean;
  [key: string]: boolean | undefined;
}

interface GroupMember {
  IsAdmin?: number | boolean;
  Name?: string;
  DisplayName?: string;
  UserName?: string;
  [key: string]: unknown;
}

interface GroupPermissionsProps {
  permissions: GroupPermissionsData;
  onPermissionChange: (name: string, value: boolean) => void;
  groupMembers?: GroupMember[];
  onEditAdmins?: () => void;
  onBack?: () => void;
}

const GroupPermissions = ({
  permissions,
  onPermissionChange,
  groupMembers = [],
  onEditAdmins,
}: GroupPermissionsProps) => {
  const admins = groupMembers.filter(
    (m) => m.IsAdmin === 1 || m.IsAdmin === true
  );

  const adminNames = admins
    .map((m) => m.Name || m.DisplayName || m.UserName || "Admin")
    .join(", ");

  return (
    <div className="permissions-view">
      <div className="permissions-content">
        <div className="permission_group">
          <Typography className="group_label">Members can:</Typography>

          <div className="permission_item">
            <Edit className="item_icon" />
            <div className="item_text">
              <Typography variant="body1">Edit group settings</Typography>
              <Typography variant="caption">
                This includes the name, icon, description, disappearing message
                timer, and pin messages.
              </Typography>
            </div>
            <IOSSwitch
              checked={permissions?.editGroupSettings ?? true}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                onPermissionChange("editGroupSettings", e.target.checked)
              }
            />
          </div>

          <div className="permission_item">
            <MessageSquare className="item_icon" />
            <div className="item_text">
              <Typography variant="body1">Send new messages</Typography>
            </div>
            <IOSSwitch
              checked={permissions?.sendMessages ?? true}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                onPermissionChange("sendMessages", e.target.checked)
              }
            />
          </div>

          <div className="permission_item">
            <UserPlus className="item_icon" />
            <div className="item_text">
              <Typography variant="body1">Add other members</Typography>
            </div>
            <IOSSwitch
              checked={permissions?.addOtherMembers ?? true}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                onPermissionChange("addOtherMembers", e.target.checked)
              }
            />
          </div>

          <div className="permission_item">
            <Trash className="item_icon" />
            <div className="item_text">
              <Typography variant="body1">Delete messages</Typography>
            </div>
            <IOSSwitch
              checked={permissions?.AllowDeleteForAll ?? true}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                onPermissionChange("AllowDeleteForAll", e.target.checked)
              }
            />
          </div>

          <div
            className="permission_item"
            style={{ opacity: 0.6, cursor: "not-allowed" }}
          >
            <Link2 className="item_icon" />
            <div className="item_text">
              <Typography variant="body1">Invite via link</Typography>
            </div>
            <IOSSwitch
              checked={permissions?.inviteToGroup ?? true}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                onPermissionChange("inviteToGroup", e.target.checked)
              }
            />
          </div>
        </div>

        <Divider />

        <div className="permission_group">
          <Typography className="group_label">Admins can:</Typography>

          <div
            className="permission_item"
            style={{ opacity: 0.6, cursor: "not-allowed" }}
          >
            <UserCheck className="item_icon" />
            <div className="item_text">
              <Typography variant="body1">Approve new members</Typography>
              <Typography variant="caption">
                When turned on, admins must approve anyone who wants to join
                this group.
              </Typography>
            </div>
            <IOSSwitch
              checked={permissions?.approveNewMembers ?? false}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                onPermissionChange("approveNewMembers", e.target.checked)
              }
            />
          </div>
        </div>

        <Divider />

        {permissions?.editGroupAdmins && (
          <div className="permission_group">
            <Typography className="group_label">Group admin:</Typography>

            <Box
              className="permission_item clickable"
              onClick={onEditAdmins}
            >
              <UserStar className="item_icon" />
              <Box className="item_text">
                <Typography variant="body1">Edit group admins</Typography>
                {adminNames && (
                  <Typography variant="caption" className="admin_names">
                    {adminNames}
                  </Typography>
                )}
              </Box>
              <ChevronRight className="chevron_icon" />
            </Box>
          </div>
        )}
      </div>
    </div>
  );
};

export default GroupPermissions;
