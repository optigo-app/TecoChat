// Ported from OldChatReactCode/src/contexts/TagsContexts.js

"use client";

import { createContext, useState } from "react";

interface Tag {
  id: string | number;
  [key: string]: unknown;
}

interface TagsContextValue {
  tags: Tag[];
  addTags: (tag: Tag) => void;
  removeTags: (tag: Tag) => void;
  refetchTrigger: number;
  triggerRefetch: () => void;
}

const TagsContext = createContext<TagsContextValue | undefined>(undefined);

export const TagsProvider = ({ children }: { children: React.ReactNode }) => {
  const [tags, setTags] = useState<Tag[]>([]);
  const [refetchTrigger, setRefetchTrigger] = useState(0);

  const addTags = (tag: Tag) => {
    setTags([...tags, tag]);
  };

  const removeTags = (tag: Tag) => {
    setTags(tags.filter((t) => t.id !== tag.id));
  };

  const triggerRefetch = () => {
    setRefetchTrigger((prev) => prev + 1);
  };

  return (
    <TagsContext.Provider
      value={{ tags, addTags, removeTags, refetchTrigger, triggerRefetch }}
    >
      {children}
    </TagsContext.Provider>
  );
};
