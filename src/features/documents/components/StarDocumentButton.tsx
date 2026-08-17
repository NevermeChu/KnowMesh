'use client';

import { Star } from 'lucide-react';
import { useState, useTransition } from 'react';
import { useToast } from '@/components/ui/Toast';
import { toggleStarredDocument } from '../server/StarredDocuments';

/**
 * Renders an interactive star/unstar toggle button for a document.
 *
 * @param props - Document id, initial star status, and optional className.
 * @returns The star toggle button.
 */
export function StarDocumentButton(props: {
  documentId: string;
  initialIsStarred?: boolean;
  className?: string;
}) {
  const [isStarred, setIsStarred] = useState(Boolean(props.initialIsStarred));
  const [isPending, startTransition] = useTransition();
  const toast = useToast();

  const handleToggle = () => {
    const previous = isStarred;
    const next = !previous;

    setIsStarred(next);
    toast.success(next ? '已加入收藏' : '已取消收藏');

    startTransition(async () => {
      try {
        const result = await toggleStarredDocument({ documentId: props.documentId });
        setIsStarred(result.isStarred);
      } catch {
        setIsStarred(previous);
        toast.error('操作失败，请重试');
      }
    });
  };

  return (
    <button
      type="button"
      aria-label={isStarred ? '取消收藏' : '收藏文档'}
      aria-pressed={isStarred}
      disabled={isPending}
      title={isStarred ? '取消收藏' : '收藏文档'}
      className={
        props.className ??
        'grid size-7 place-items-center rounded-lg text-ink-muted transition-all hover:bg-overlay hover:text-ink active:scale-90 disabled:opacity-50'
      }
      onClick={handleToggle}
    >
      <Star
        aria-hidden="true"
        className={`size-4 transition-all duration-200 ${
          isStarred
            ? 'scale-110 fill-amber-500 text-amber-500 dark:fill-amber-400 dark:text-amber-400'
            : 'text-ink-muted hover:text-ink'
        }`}
        strokeWidth={1.8}
      />
    </button>
  );
}
