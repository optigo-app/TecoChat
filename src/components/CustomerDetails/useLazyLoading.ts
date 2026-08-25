"use client";

import { useEffect, useRef, useCallback } from "react";

export const useLazyLoading = (
  callback: (() => void) | null,
  hasMore: boolean,
  isLoading: boolean
) => {
  const observer = useRef<IntersectionObserver | null>(null);
  const hasTriggeredRef = useRef(false);

  useEffect(() => {
    if (!isLoading) {
      hasTriggeredRef.current = false;
    }
  }, [isLoading]);

  useEffect(() => {
    return () => {
      if (observer.current) observer.current.disconnect();
    };
  }, []);

  const lastElementRef = useCallback(
    (node: HTMLElement | null) => {
      if (isLoading) return;
      if (observer.current) observer.current.disconnect();
      observer.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && hasMore && !hasTriggeredRef.current && callback) {
          hasTriggeredRef.current = true;
          callback();
        }
      });
      if (node) observer.current.observe(node);
    },
    [isLoading, hasMore, callback]
  );

  return lastElementRef;
};

export default useLazyLoading;
