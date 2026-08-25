"use client";

import { CircleMinus, LogOut, Trash2 } from "lucide-react";

interface DangerZoneProps {
  onClearChat: () => void;
  isGroup: boolean;
  onExitGroup: () => void;
  isRemovedFromCurrentGroup: boolean;
  onDeleteChat: () => void;
}

const DangerZone = ({
  onClearChat,
  isGroup,
  onExitGroup,
  isRemovedFromCurrentGroup,
  onDeleteChat,
}: DangerZoneProps) => {
  return (
    <div className="danger-zone">
      {isGroup ? (
        <>
          <div className="danger-item" onClick={onClearChat} style={{ cursor: "pointer" }}>
            <CircleMinus size={20} />
            <span>Clear chat</span>
          </div>
          {isRemovedFromCurrentGroup ? (
            <div className="danger-item" onClick={onDeleteChat} style={{ cursor: "pointer" }}>
              <Trash2 size={20} />
              <span>Delete group</span>
            </div>
          ) : (
            <div className="danger-item" onClick={onExitGroup} style={{ cursor: "pointer" }}>
              <LogOut size={20} />
              <span>Exit group</span>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="danger-item" onClick={onClearChat} style={{ cursor: "pointer" }}>
            <CircleMinus size={20} />
            <span>Clear chat</span>
          </div>
          <div className="danger-item" onClick={onDeleteChat} style={{ cursor: "pointer" }}>
            <Trash2 size={20} />
            <span>Delete chat</span>
          </div>
        </>
      )}
    </div>
  );
};

export default DangerZone;
