"use client";

import { Typography, Box, TextField, InputAdornment, IconButton } from "@mui/material";
import { Pencil, X, Check } from "lucide-react";
import { formatDateTime } from "../../utils/dateUtils";
import { renderEmojiText } from "../../utils/messageTextRenderer";

interface GroupPermissionsData {
  editGroupSettings?: boolean;
  [key: string]: boolean | undefined;
}

interface LocalGroupData {
  description?: string;
  entryDate?: string;
  createdBy?: string;
  [key: string]: unknown;
}

interface GroupDescriptionProps {
  localGroupData: LocalGroupData;
  isCurrentUserAdmin: boolean | undefined;
  isEditingDesc: boolean;
  editedDesc: string;
  setEditedDesc: (value: string) => void;
  handleSaveDesc: () => void;
  startEditingDesc: () => void;
  setIsEditingDesc: (open: boolean) => void;
  groupPermissions?: GroupPermissionsData;
}

const GroupDescription = ({
  localGroupData,
  isCurrentUserAdmin,
  isEditingDesc,
  editedDesc,
  setEditedDesc,
  handleSaveDesc,
  startEditingDesc,
  setIsEditingDesc,
  groupPermissions,
}: GroupDescriptionProps) => {
  const canEditGroup = isCurrentUserAdmin || groupPermissions?.editGroupSettings;
  const date = formatDateTime(localGroupData.entryDate as string, "dateLocal");
  const time = formatDateTime(localGroupData.entryDate as string, "time");
  return (
    <div className="info-block desc-block">
      <div className="desc-header">
        <Typography className="block-label accent-label">
          {localGroupData.description ? "Group description" : "Add group description"}
        </Typography>
        {!isEditingDesc && canEditGroup && (
          <IconButton size="small" className="edit-icon-btn" onClick={startEditingDesc}>
            <Pencil size={20} />
          </IconButton>
        )}
      </div>

      {isEditingDesc ? (
        <Box sx={{ mt: 1 }}>
          <TextField
            fullWidth
            multiline
            variant="standard"
            value={editedDesc || ""}
            onChange={(e) => setEditedDesc(e.target.value.slice(0, 256))}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setEditedDesc(localGroupData?.description || "");
                setIsEditingDesc(false);
              }
            }}
            helperText={`${(editedDesc || "").length}/256`}
            slotProps={{
              input: {
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      size="small"
                      onClick={() => {
                        setEditedDesc(localGroupData?.description || "");
                        setIsEditingDesc(false);
                      }}
                      sx={{ color: "var(--color-text-secondary)", mr: 0.5 }}
                    >
                      <X size={18} />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={handleSaveDesc}
                      sx={{ color: "primary.main" }}
                    >
                      <Check size={20} />
                    </IconButton>
                  </InputAdornment>
                ),
              },
            }}
          />
        </Box>
      ) : (
        <Typography
          className="block-value"
          style={{ cursor: canEditGroup ? "pointer" : "default" }}
          onClick={canEditGroup ? startEditingDesc : undefined}
        >
          {renderEmojiText(localGroupData.description || "")}
        </Typography>
      )}

      {(localGroupData.createdBy || localGroupData.entryDate) && (
        <Typography sx={{ mt: 1.5, mb: 0.5, fontSize: "14px", color: "var(--color-text-secondary)" }}>
          Group created by {localGroupData.createdBy || ""}, on {date} at {time}
        </Typography>
      )}
    </div>
  );
};

export default GroupDescription;
