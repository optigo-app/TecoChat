"use client";

import React from "react";
import {
  $applyNodeReplacement,
  type DOMConversionMap,
  type DOMExportOutput,
  type EditorConfig,
  type LexicalNode,
  type NodeKey,
  type Spread,
  DecoratorNode,
  type SerializedLexicalNode,
} from "lexical";
import { SafeEmoji } from "./SafeEmoji";

// ── Types ────────────────────────────────────────────────────────────────────

export type SerializedEmojiNode = Spread<
  {
    emoji: string;
    unified: string;
  },
  SerializedLexicalNode
>;

// ── EmojiNode (HMR-safe singleton) ───────────────────────────────────────────

const globalObj = typeof globalThis !== "undefined" ? globalThis : window;

interface EmojiNodeClass extends DecoratorNode<React.ReactNode> {
  __emoji: string;
  __unified: string;
  new (emoji: string, unified: string, key?: NodeKey): DecoratorNode<React.ReactNode> & {
    __emoji: string;
    __unified: string;
    getEmoji(): string;
    getUnified(): string;
  };
  getType(): string;
  clone(node: InstanceType<EmojiNodeClass>): InstanceType<EmojiNodeClass>;
  importJSON(serializedNode: SerializedEmojiNode): InstanceType<EmojiNodeClass>;
  importDOM(): DOMConversionMap | null;
}

function createEmojiNodeClass() {
  class EmojiNode extends DecoratorNode<React.ReactNode> {
    __emoji: string;
    __unified: string;

    constructor(emoji: string, unified: string, key?: NodeKey) {
      super(key);
      this.__emoji = emoji;
      this.__unified = unified;
    }

    static getType(): string {
      return "emoji";
    }

    static clone(node: EmojiNode): EmojiNode {
      return new EmojiNode(node.__emoji, node.__unified, node.__key);
    }

    static importJSON(serializedNode: SerializedEmojiNode): EmojiNode {
      return new EmojiNode(serializedNode.emoji, serializedNode.unified);
    }

    exportJSON(): SerializedEmojiNode {
      return {
        ...super.exportJSON(),
        emoji: this.__emoji,
        unified: this.__unified,
      };
    }

    createDOM(_config: EditorConfig): HTMLElement {
      const span = document.createElement("span");
      span.className = "editor-emoji";
      span.setAttribute("data-emoji", "true");
      span.setAttribute("data-unified", this.__unified);
      return span;
    }

    updateDOM(): boolean {
      return false;
    }

    exportDOM(): DOMExportOutput {
      const element = document.createElement("span");
      element.textContent = this.__emoji;
      element.setAttribute("data-emoji", "true");
      element.setAttribute("data-unified", this.__unified);
      return { element };
    }

    static importDOM(): DOMConversionMap | null {
      return {
        span: (node: HTMLElement) => {
          if (node.getAttribute("data-emoji") === "true") {
            return {
              conversion: (domNode: HTMLElement) => {
                const emoji = domNode.textContent || "";
                const unified = domNode.getAttribute("data-unified") || "";
                return {
                  node: $createEmojiNode(emoji, unified),
                };
              },
              priority: 1,
            } as any;
          }
          return null;
        },
      };
    }

    // Text export — returns the raw emoji character so markdown/text export
    // produces the emoji, not the image URL.
    getTextContent(): string {
      return this.__emoji;
    }

    getEmoji(): string {
      return this.__emoji;
    }

    getUnified(): string {
      return this.__unified;
    }

    // Decorator — renders the Apple-style emoji image. Falls back to the
    // native emoji character if the CDN image fails to load (some emojis
    // are not available on the Apple CDN, which would otherwise show a
    // broken-image icon in the chat input).
    decorate(): React.ReactNode {
      return (
        <SafeEmoji
          unified={this.__unified}
          emoji={this.__emoji}
          size={20}
        />
      );
    }

    isInline(): boolean {
      return true;
    }

    isTextEntity(): boolean {
      return true;
    }
  }

  return EmojiNode;
}

// Reuse the same class across HMR reloads
const globalRecord = globalObj as Record<string, unknown>;
let StableEmojiNode: typeof DecoratorNode & {
  new (emoji: string, unified: string, key?: NodeKey): DecoratorNode<React.ReactNode> & {
    __emoji: string;
    __unified: string;
    getEmoji(): string;
    getUnified(): string;
  };
};

if (!globalRecord.__EmojiNodeClass__) {
  globalRecord.__EmojiNodeClass__ = createEmojiNodeClass();
}
StableEmojiNode = globalRecord.__EmojiNodeClass__ as typeof StableEmojiNode;

export { StableEmojiNode as EmojiNode };

// ── Helpers ──────────────────────────────────────────────────────────────────

type EmojiNodeInstance = DecoratorNode<React.ReactNode> & {
  __emoji: string;
  __unified: string;
  getEmoji(): string;
  getUnified(): string;
};

export function $isEmojiNode(node: LexicalNode | null | undefined): node is EmojiNodeInstance {
  return node instanceof StableEmojiNode;
}

export function $createEmojiNode(emoji: string, unified: string): EmojiNodeInstance {
  const node = new StableEmojiNode(emoji, unified);
  return $applyNodeReplacement(node) as EmojiNodeInstance;
}
