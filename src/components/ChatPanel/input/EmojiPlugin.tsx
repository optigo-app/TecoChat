"use client";

import { useEffect, useRef } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  TextNode,
  type LexicalNode,
  type ElementNode,
  $getRoot,
  $getSelection,
  $isRangeSelection,
  $getNodeByKey,
} from "lexical";
import { $isEmojiNode, $createEmojiNode } from "./EmojiNode";
import { charToUnified } from "../../../utils/EmojiUtils";

// Emoji detection regex — matches single emoji characters
const EMOJI_REGEX = /(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/g;

function containsEmoji(text: string): boolean {
  if (!text) return false;
  const regex = new RegExp(EMOJI_REGEX.source, "g");
  return regex.test(text);
}

function splitEmojiText(text: string): Array<{ type: "text" | "emoji"; value: string }> {
  const segments: Array<{ type: "text" | "emoji"; value: string }> = [];
  if (!text) return segments;

  const regex = new RegExp(EMOJI_REGEX.source, "g");
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "text", value: text.slice(lastIndex, match.index) });
    }
    segments.push({ type: "emoji", value: match[0] });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    segments.push({ type: "text", value: text.slice(lastIndex) });
  }

  return segments;
}

// Convert a text string that contains emojis into mixed TextNode + EmojiNode array
function convertTextToEmojiNodes(text: string): LexicalNode[] | null {
  if (!containsEmoji(text)) return null;

  const segments = splitEmojiText(text);
  if (segments.length <= 1) return null;

  const nodes: LexicalNode[] = [];
  for (const seg of segments) {
    if (seg.type === "emoji") {
      const unified = charToUnified(seg.value);
      if (unified) {
        nodes.push($createEmojiNode(seg.value, unified));
        continue;
      }
    }
    nodes.push(new TextNode(seg.value));
  }

  return nodes;
}

export default function EmojiPlugin() {
  const [editor] = useLexicalComposerContext();
  const isUpdatingRef = useRef(false);

  useEffect(() => {
    const removeUpdate = editor.registerUpdateListener(({ editorState, dirtyLeaves }) => {
      if (dirtyLeaves.size === 0) return;
      if (isUpdatingRef.current) return;

      // Collect node KEYS (not references) that need conversion.
      // Also track the selection anchor key + offset for cursor restoration.
      const nodesToConvert: Array<{ key: string; anchorOffset?: number }> = [];

      editorState.read(() => {
        const selection = $getSelection();
        let anchorKey: string | null = null;
        let anchorOffset = 0;
        if ($isRangeSelection(selection) && selection.isCollapsed()) {
          anchorKey = selection.anchor.key;
          anchorOffset = selection.anchor.offset;
        }

        const root = $getRoot();
        root.getChildren().forEach((paragraph) => {
          if ("getChildren" in paragraph) {
            (paragraph as ElementNode).getChildren().forEach((node) => {
              if ($isEmojiNode(node)) return;
              if (!(node instanceof TextNode)) return;

              const text = node.getTextContent();
              if (!containsEmoji(text)) return;

              const entry: { key: string; anchorOffset?: number } = { key: node.getKey() };
              if (anchorKey === node.getKey()) {
                entry.anchorOffset = anchorOffset;
              }
              nodesToConvert.push(entry);
            });
          }
        });
      });

      if (nodesToConvert.length === 0) return;

      // Perform the conversion in a new update — look up nodes by key
      // since references from the read pass are stale inside a new update.
      isUpdatingRef.current = true;
      editor.update(() => {
        for (const { key, anchorOffset } of nodesToConvert) {
          // Look up the node by key in the CURRENT editor state
          const node = $getNodeByKey(key);
          if (!node) continue;
          if ($isEmojiNode(node)) continue;
          if (!(node instanceof TextNode)) continue;

          const text = node.getTextContent();
          const newNodes = convertTextToEmojiNodes(text);
          if (!newNodes || newNodes.length === 0) continue;

          // Calculate new selection offset if this node had the cursor
          let restoreSelection: { nodeIndex: number; offset: number } | null = null;
          if (anchorOffset !== undefined) {
            let runningLength = 0;
            for (let index = 0; index < newNodes.length; index++) {
              const nodeLen = newNodes[index].getTextContent().length;
              if (runningLength + nodeLen >= anchorOffset) {
                restoreSelection = { nodeIndex: index, offset: anchorOffset - runningLength };
                break;
              }
              runningLength += nodeLen;
            }
            // If cursor was at the very end, place it after the last node
            if (!restoreSelection) {
              const nodeIndex = newNodes.length - 1;
              const lastLen = newNodes[nodeIndex].getTextContent().length;
              restoreSelection = { nodeIndex, offset: lastLen };
            }
          }

          // Replace the text node with the new nodes
          const lastNode = newNodes[newNodes.length - 1];
          node.replace(lastNode);

          // Insert remaining nodes before the last one
          for (let i = newNodes.length - 2; i >= 0; i--) {
            lastNode.insertBefore(newNodes[i]);
          }

          // Restore cursor position on the node that contains the offset
          if (restoreSelection) {
            const selectionNode = newNodes[restoreSelection.nodeIndex];
            if ("select" in selectionNode) {
              (selectionNode as TextNode).select(restoreSelection.offset, restoreSelection.offset);
            } else if (restoreSelection.offset === 0) {
              selectionNode.selectPrevious();
            } else {
              selectionNode.selectNext();
            }
          }
        }
      }, {
        onUpdate: () => {
          isUpdatingRef.current = false;
        },
      });
    });

    return () => {
      removeUpdate();
    };
  }, [editor]);

  return null;
}
