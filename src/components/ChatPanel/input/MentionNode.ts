"use client";

import {
  $applyNodeReplacement,
  type DOMConversionMap,
  type DOMExportOutput,
  type EditorConfig,
  type NodeKey,
  type SerializedTextNode,
  type Spread,
  TextNode,
} from "lexical";

// ── Types ────────────────────────────────────────────────────────────────────

export interface MentionData {
  userId: string | number;
  userName: string;
  mentionText: string;
}

export type SerializedMentionNode = Spread<
  {
    mentionData: MentionData;
  },
  SerializedTextNode
>;

// ── MentionNode (HMR-safe singleton) ─────────────────────────────────────────
// Lexical checks that the class used to create a node matches the class
// registered in the editor. Next.js HMR re-evaluates this module, creating a
// new class instance that doesn't match the editor's registered one. We store
// the class on a global so the same class identity persists across HMR reloads.

const globalObj = typeof globalThis !== "undefined" ? globalThis : window;

interface MentionNodeClass extends TextNode {
  __mentionData: MentionData;
  new (mentionData: MentionData, text?: string, key?: NodeKey): InstanceType<typeof TextNode> & {
    __mentionData: MentionData;
    getMentionData(): MentionData;
  };
  getType(): string;
  clone(node: InstanceType<MentionNodeClass>): InstanceType<MentionNodeClass>;
  importJSON(serializedNode: SerializedMentionNode): InstanceType<MentionNodeClass>;
  importDOM(): DOMConversionMap | null;
}

function createMentionNodeClass() {
  class MentionNode extends TextNode {
    __mentionData: MentionData;

    constructor(mentionData: MentionData, text?: string, key?: NodeKey) {
      const displayText = text ?? mentionData.mentionText;
      super(displayText, key);
      this.__mentionData = mentionData;
      this.__format = 0;
      this.__style = "";
    }

    static getType(): string {
      return "mention";
    }

    static clone(node: MentionNode): MentionNode {
      return new MentionNode(node.__mentionData, node.__text, node.__key);
    }

    static importJSON(serializedNode: SerializedMentionNode): MentionNode {
      const node = new MentionNode(serializedNode.mentionData, serializedNode.text);
      node.setFormat(serializedNode.format);
      node.setDetail(serializedNode.detail);
      node.setMode(serializedNode.mode);
      node.setStyle(serializedNode.style);
      return node;
    }

    exportJSON(): SerializedMentionNode {
      return {
        ...super.exportJSON(),
        mentionData: this.__mentionData,
        type: "mention",
      };
    }

    createDOM(config: EditorConfig): HTMLElement {
      const dom = super.createDOM(config);
      dom.className = "editor-mention-chip";
      dom.setAttribute("data-mention", "true");
      dom.setAttribute("data-mention-user-id", String(this.__mentionData.userId));
      return dom;
    }

    updateDOM(prevNode: MentionNode, dom: HTMLElement, config: EditorConfig): boolean {
      const updated = super.updateDOM(prevNode as this, dom, config);
      if (!dom.classList.contains("editor-mention-chip")) {
        dom.className = "editor-mention-chip";
      }
      return updated;
    }

    exportDOM(): DOMExportOutput {
      const element = document.createElement("span");
      element.textContent = this.__text;
      element.setAttribute("data-mention-user-id", String(this.__mentionData.userId));
      element.setAttribute("data-mention", "true");
      return { element };
    }

    static importDOM(): DOMConversionMap | null {
      return {
        span: (node: HTMLElement) => {
          if (node.getAttribute("data-mention") === "true") {
            return {
              conversion: (domNode: HTMLElement) => {
                const userId = domNode.getAttribute("data-mention-user-id") || "";
                const text = domNode.textContent || "";
                return {
                  node: new MentionNode({ userId, userName: text, mentionText: text }),
                };
              },
              priority: 1,
            };
          }
          return null;
        },
      };
    }

    setFormat(format: number): this {
      return this;
    }

    getMentionData(): MentionData {
      return this.__mentionData;
    }

    splitText(..._splitOffsets: number[]): TextNode[] {
      return [this];
    }

    canInsertTextBefore(): boolean {
      return false;
    }

    canInsertTextAfter(): boolean {
      return false;
    }

    isTextEntity(): boolean {
      return true;
    }
  }

  return MentionNode;
}

// Reuse the same class across HMR reloads
const globalRecord = globalObj as Record<string, unknown>;
let StableMentionNode: typeof TextNode & {
  new (mentionData: MentionData, text?: string, key?: NodeKey): TextNode & {
    __mentionData: MentionData;
    getMentionData(): MentionData;
  };
};

if (!globalRecord.__MentionNodeClass__) {
  globalRecord.__MentionNodeClass__ = createMentionNodeClass();
}
StableMentionNode = globalRecord.__MentionNodeClass__ as typeof StableMentionNode;

export { StableMentionNode as MentionNode };

// ── Helpers ──────────────────────────────────────────────────────────────────

type MentionNodeInstance = TextNode & {
  __mentionData: MentionData;
  getMentionData(): MentionData;
};

export function $createMentionNode(mentionData: MentionData): MentionNodeInstance {
  const node = new StableMentionNode(mentionData);
  return $applyNodeReplacement(node) as MentionNodeInstance;
}
