// Simple module-level queue for files dropped on conversation items
// before the conversation component mounts.
const pendingDrops = new Map<number, File[]>();

export const queueDroppedFiles = (conversationId: string | number, files: File[]): void => {
  if (!conversationId || !files?.length) return;
  const key = Number(conversationId);
  pendingDrops.set(key, files);
  // Dispatch event so an already-selected conversation can pick up the files
  window.dispatchEvent(
    new CustomEvent("FILES_DROPPED_ON_CONVERSATION", { detail: { conversationId: key } })
  );
};

export const getAndClearDroppedFiles = (conversationId: string | number): File[] | null => {
  if (!conversationId) return null;
  const key = Number(conversationId);
  const files = pendingDrops.get(key);
  if (files) {
    pendingDrops.delete(key);
  }
  return files || null;
};
