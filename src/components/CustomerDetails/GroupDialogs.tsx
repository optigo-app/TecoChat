"use client";

import AddMemberDialog from "../ReusableComponent/AddMemberDialog";

interface LocalGroupMember {
  UserId: string | number;
  IsAdmin?: number | boolean;
  [key: string]: unknown;
}

interface LocalGroupData {
  members: LocalGroupMember[];
  createdById?: string | number | null;
  [key: string]: unknown;
}

interface GroupDialogsProps {
  isAddMemberDialogOpen: boolean;
  setIsAddMemberDialogOpen: (open: boolean) => void;
  handleAddMembersSubmit: (selectedIds: (string | number)[]) => void;
  localGroupData: LocalGroupData;
  isParticipantSearchOpen: boolean;
  setIsParticipantSearchOpen: (open: boolean) => void;
  handleMemberClick: (event: React.MouseEvent, member: any) => void;
  isEditAdminDialogOpen: boolean;
  setIsEditAdminDialogOpen: (open: boolean) => void;
  handleEditAdminsSubmit: (selectedIds: (string | number)[]) => void;
}

const GroupDialogs = ({
  isAddMemberDialogOpen,
  setIsAddMemberDialogOpen,
  handleAddMembersSubmit,
  localGroupData,
  isParticipantSearchOpen,
  setIsParticipantSearchOpen,
  handleMemberClick,
  isEditAdminDialogOpen,
  setIsEditAdminDialogOpen,
  handleEditAdminsSubmit,
}: GroupDialogsProps) => {
  const adminIds = (localGroupData.members || [])
    .filter((m) => m.IsAdmin === 1 || m.IsAdmin === true)
    .map((m) => m.UserId);

  const disabledIds = localGroupData.createdById
    ? [localGroupData.createdById]
    : [];

  return (
    <>
      {/* Add Member Dialog */}
      <AddMemberDialog
        open={isAddMemberDialogOpen}
        onClose={() => setIsAddMemberDialogOpen(false)}
        onSubmit={handleAddMembersSubmit}
        existingMemberIds={localGroupData.members.map((m) => m.UserId)}
      />

      <AddMemberDialog
        open={isParticipantSearchOpen}
        onClose={() => setIsParticipantSearchOpen(false)}
        onSubmit={() => {}}
        mode="search"
        groupMembers={localGroupData.members}
        onMemberClick={handleMemberClick}
      />

      {/* Edit Group Admins Dialog */}
      <AddMemberDialog
        open={isEditAdminDialogOpen}
        onClose={() => setIsEditAdminDialogOpen(false)}
        onSubmit={handleEditAdminsSubmit}
        mode="editAdmins"
        groupMembers={localGroupData.members}
        preSelectedIds={adminIds}
        disabledIds={disabledIds}
      />
    </>
  );
};

export default GroupDialogs;
