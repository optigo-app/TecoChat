"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $getSelection,
  $isRangeSelection,
  $isTextNode,
  $createTextNode,
  $getRoot,
  $applyNodeReplacement,
  COMMAND_PRIORITY_LOW,
  KEY_DOWN_COMMAND,
  BLUR_COMMAND,
  type ElementNode,
  type TextNode,
} from "lexical";
import { $createMentionNode, type MentionData } from "./MentionNode";
import MentionDropdown, { type MentionMember } from "./MentionDropdown";

// Get the MentionNode class registered in the editor (HMR-safe).
// After HMR, the module's class identity changes but the editor keeps the
// originally registered class. We read it from the editor's internal map.
function getRegisteredMentionKlass(editor: import("lexical").LexicalEditor): typeof TextNode | null {
  const nodes = (editor as unknown as { _nodes?: Map<string, { klass: typeof TextNode }> })._nodes;
  return nodes?.get("mention")?.klass ?? null;
}

interface MentionPluginProps {
  members: MentionMember[];
  onMentionsChange?: (mentions: MentionData[]) => void;
  excludeUserId?: string | number;
  onFetchMembers?: () => void;
}

// Extract mentions from the editor state (HMR-safe: checks type string instead of instanceof)
function $extractMentions(): MentionData[] {
  const mentions: MentionData[] = [];
  const root = $getRoot();
  root.getChildren().forEach((paragraph) => {
    if ("getChildren" in paragraph) {
      (paragraph as ElementNode).getChildren().forEach((node) => {
        // Check by type string to be HMR-safe
        if (node.getType() === "mention") {
          const data = (node as unknown as { __mentionData?: MentionData }).__mentionData;
          if (data) mentions.push(data);
        }
      });
    }
  });
  return mentions;
}

const MentionPlugin: React.FC<MentionPluginProps> = ({
  members,
  onMentionsChange,
  excludeUserId,
  onFetchMembers,
}) => {
  const [editor] = useLexicalComposerContext();
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const queryStartRef = useRef<number | null>(null);
  const filteredMembersRef = useRef<MentionMember[]>([]);

  // Build display list: "all" option + filtered members
  const displayList = React.useMemo(() => {
    let list = members;
    if (excludeUserId !== undefined) {
      list = list.filter((m) => String(m.UserId) !== String(excludeUserId));
    }
    if (!searchQuery) {
      // Show "all" + all members
      const allItem: MentionMember = {
        UserId: "all",
        UserName: "all",
        DisplayName: "all",
      };
      return [allItem, ...list];
    }
    const q = searchQuery.toLowerCase();
    const filtered = list.filter((m) => {
      const name = (m.MemberName || m.UserName || m.DisplayName || "").toLowerCase();
      return name.includes(q);
    });
    // Show "all" if it matches the query
    if ("all".includes(q)) {
      const allItem: MentionMember = {
        UserId: "all",
        UserName: "all",
        DisplayName: "all",
      };
      return [allItem, ...filtered];
    }
    return filtered;
  }, [members, searchQuery, excludeUserId]);

  filteredMembersRef.current = displayList;

  // Notify parent of mentions whenever editor changes
  useEffect(() => {
    return editor.registerUpdateListener(({ editorState, dirtyElements, dirtyLeaves }) => {
      if (dirtyElements.size === 0 && dirtyLeaves.size === 0) return;
      editorState.read(() => {
        const mentions = $extractMentions();
        onMentionsChange?.(mentions);
      });
    });
  }, [editor, onMentionsChange]);

  // Detect @ trigger and build search query
  useEffect(() => {
    return editor.registerUpdateListener(({ editorState, dirtyLeaves }) => {
      if (dirtyLeaves.size === 0) {
        return;
      }
      editorState.read(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
          setShowDropdown(false);
          return;
        }

        const node = selection.anchor.getNode();
        if (!$isTextNode(node)) {
          setShowDropdown(false);
          return;
        }

        const text = node.getTextContent();
        const offset = selection.anchor.offset;

        // Find the last @ before the cursor that isn't preceded by a non-space char
        let atIdx = -1;
        for (let i = offset - 1; i >= 0; i--) {
          if (text[i] === "@") {
            // Must be at start or preceded by whitespace
            if (i === 0 || /\s/.test(text[i - 1])) {
              atIdx = i;
            }
            break;
          }
          if (/\s/.test(text[i])) {
            break;
          }
        }

        if (atIdx === -1) {
          setShowDropdown(false);
          setSearchQuery("");
          queryStartRef.current = null;
          return;
        }

        const query = text.slice(atIdx + 1, offset);
        // Only show dropdown if query has no spaces and is reasonable length
        if (query.includes(" ") || query.length > 30) {
          setShowDropdown(false);
          return;
        }

        // Position dropdown at cursor using getBoundingClientRect (like formatting toolbar)
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
          const range = sel.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          // Place dropdown above the cursor; if not enough space, Popper will flip
          setDropdownPos({
            top: rect.top,
            left: rect.left,
          });
        }

        // Fetch members on-demand every time @ is typed so the dropdown
        // always shows real-time data from the API, not stale cached state.
        if (onFetchMembers) {
          setIsLoading(true);
          onFetchMembers();
        }

        queryStartRef.current = atIdx;
        setSearchQuery(query);
        setShowDropdown(true);
        setSelectedIndex(0);
      });
    });
  }, [editor, onFetchMembers]);

  // Reset fetch flag when members load
  useEffect(() => {
    if (members.length > 0 && isLoading) {
      setIsLoading(false);
    }
  }, [members.length, isLoading]);

  // Insert a mention at the current cursor position
  const insertMention = useCallback(
    (member: MentionMember) => {
      const name = member.MemberName || member.UserName || member.DisplayName || "User";
      const isAllMention = String(member.UserId) === "all";
      const mentionData: MentionData = {
        userId: isAllMention ? "all" : (member.UserId || 0),
        userName: name,
        mentionText: `@${name}`,
      };

      editor.update(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
          return;
        }

        const node = selection.anchor.getNode();
        if (!$isTextNode(node)) {
          return;
        }

        const text = node.getTextContent();
        const offset = selection.anchor.offset;
        const atIdx = queryStartRef.current ?? text.lastIndexOf("@");

        if (atIdx < 0 || atIdx >= offset) return;

        // Split text: before @, mention node, after cursor
        const beforeText = text.slice(0, atIdx);
        const afterText = text.slice(offset);

        // Use the registered MentionNode class from the editor (HMR-safe)
        const MentionKlass = getRegisteredMentionKlass(editor);
        const mentionNode = MentionKlass
          ? $applyNodeReplacement(new (MentionKlass as unknown as new (data: MentionData) => TextNode)(mentionData))
          : $createMentionNode(mentionData);
        const spaceNode = $createTextNode("\u00a0"); // non-breaking space after mention

        // Replace current node content
        const parent = node.getParent();
        if (!parent) return;

        const beforeNode = beforeText ? $createTextNode(beforeText) : null;
        const afterNode = afterText ? $createTextNode(afterText) : null;

        // Insert nodes in order
        if (beforeNode) {
          node.insertBefore(beforeNode);
        }
        node.insertBefore(mentionNode);
        node.insertBefore(spaceNode);
        if (afterNode) {
          node.insertBefore(afterNode);
        }

        // Remove original node
        node.remove();

        // Move selection to after the space
        spaceNode.select(0, 0);
      });

      setShowDropdown(false);
      setSearchQuery("");
      queryStartRef.current = null;
      editor.focus();
    },
    [editor]
  );

  // Keyboard navigation when dropdown is open
  useEffect(() => {
    if (!showDropdown) return;

    const handleKeyDown = (event: KeyboardEvent): boolean => {
      const list = filteredMembersRef.current;
      if (list.length === 0) return false;

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % list.length);
        return true;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + list.length) % list.length);
        return true;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        const member = list[selectedIndex];
        if (member) {
          insertMention(member);
        }
        return true;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        setShowDropdown(false);
        setSearchQuery("");
        queryStartRef.current = null;
        return true;
      }

      if (event.key === "Tab") {
        event.preventDefault();
        const member = list[selectedIndex];
        if (member) {
          insertMention(member);
        }
        return true;
      }

      return false;
    };

    const unregister = editor.registerCommand(
      KEY_DOWN_COMMAND,
      handleKeyDown,
      COMMAND_PRIORITY_LOW
    );

    return () => {
      unregister();
    };
  }, [editor, showDropdown, selectedIndex, insertMention]);

  // Close dropdown on blur
  useEffect(() => {
    return editor.registerCommand(
      BLUR_COMMAND,
      () => {
        // Delay to allow click on dropdown to register
        setTimeout(() => setShowDropdown(false), 150);
        return false;
      },
      COMMAND_PRIORITY_LOW
    );
  }, [editor]);

  return (
    <MentionDropdown
      members={displayList}
      selectedIndex={selectedIndex}
      onSelect={insertMention}
      onClose={() => {
        setShowDropdown(false);
        setSearchQuery("");
        queryStartRef.current = null;
      }}
      position={dropdownPos}
      visible={showDropdown}
      isLoading={isLoading}
    />
  );
};

export default MentionPlugin;

// Re-export for convenience
export type { MentionData };
