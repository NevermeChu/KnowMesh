'use client';

import type { Editor } from '@tiptap/react';
import { useEditorState } from '@tiptap/react';
import { ChevronLeft, ChevronRight, ListTree } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

export type DocumentHeading = {
  id: string;
  level: number;
  pos: number;
  text: string;
};

/**
 * Traverses ProseMirror doc AST to extract all heading nodes (H1-H3).
 *
 * @param editor - Active Tiptap editor instance.
 * @returns Array of structured heading metadata.
 */
export function extractHeadings(editor: Editor | null): DocumentHeading[] {
  if (!editor || editor.isDestroyed) {
    return [];
  }

  const headings: DocumentHeading[] = [];
  const { doc } = editor.state;

  doc.descendants((node, pos) => {
    if (node.type.name === 'heading') {
      const level = Number(node.attrs.level ?? 1);
      const text = node.textContent.trim();
      if (text) {
        headings.push({
          id: `heading-${pos}-${text.slice(0, 16)}`,
          level,
          pos,
          text,
        });
      }
    }
  });

  return headings;
}

/**
 * Renders the document outline (TOC) with scrollspy active heading tracking and frosted glass styling.
 *
 * @param props - Active Tiptap editor and optional expansion state control.
 * @returns The document outline widget.
 */
export function DocumentOutline(props: {
  editor: Editor | null;
  isExpanded?: boolean;
  onToggleExpanded?: (expanded: boolean) => void;
}) {
  const [internalExpanded, setInternalExpanded] = useState(true);
  const isExpanded = props.isExpanded ?? internalExpanded;

  const handleSetExpanded = (expanded: boolean) => {
    setInternalExpanded(expanded);
    props.onToggleExpanded?.(expanded);
  };

  const [activeHeadingId, setActiveHeadingId] = useState<string | null>(null);

  const headings =
    useEditorState({
      editor: props.editor,
      selector: (ctx) => extractHeadings(ctx.editor),
    }) ?? [];

  const headingsRef = useRef(headings);
  headingsRef.current = headings;

  // Scrollspy: Track active heading relative to viewport
  useEffect(() => {
    const { editor } = props;
    let cleanup: (() => void) | undefined;

    if (editor && !editor.isDestroyed) {
      const updateActiveHeading = () => {
        if (editor.isDestroyed) {
          return;
        }

        const currentHeadings = headingsRef.current;
        if (currentHeadings.length === 0) {
          setActiveHeadingId(null);
          return;
        }

        const topThreshold = 180;
        let currentActiveId: string | null = null;

        for (const heading of currentHeadings) {
          try {
            const coords = editor.view.coordsAtPos(heading.pos);
            if (coords.top <= topThreshold) {
              currentActiveId = heading.id;
            } else {
              break;
            }
          } catch {
            // View coords may temporarily be unavailable during doc transforms
          }
        }

        const [firstHeading] = currentHeadings;
        setActiveHeadingId(currentActiveId ?? firstHeading?.id ?? null);
      };

      updateActiveHeading();
      window.addEventListener('scroll', updateActiveHeading, { passive: true });
      cleanup = () => {
        window.removeEventListener('scroll', updateActiveHeading);
      };
    } else {
      setActiveHeadingId(null);
    }

    return () => {
      cleanup?.();
    };
  }, [props.editor]);

  if (!props.editor || props.editor.isDestroyed) {
    return null;
  }

  const scrollToHeading = (pos: number) => {
    if (!props.editor || props.editor.isDestroyed) {
      return;
    }

    props.editor.chain().focus().setTextSelection(pos).run();
    try {
      const coords = props.editor.view.coordsAtPos(pos);
      window.scrollTo({
        behavior: 'smooth',
        top: window.scrollY + coords.top - 120,
      });
    } catch {
      // Fallback focus handled by setTextSelection
    }
  };

  if (!isExpanded) {
    return (
      <aside aria-label="文档大纲" className="fixed top-20 right-6 z-20 hidden xl:block">
        <button
          type="button"
          title="展开大纲目录"
          aria-label="展开大纲目录"
          className="flex items-center gap-1.5 rounded-xl border border-line/70 bg-card/85 px-3 py-1.5 text-xs font-medium text-ink-muted shadow-card backdrop-blur-md transition-all hover:border-line hover:bg-card hover:text-ink active:scale-95"
          onClick={() => {
            handleSetExpanded(true);
          }}
        >
          <ListTree aria-hidden="true" className="size-3.5 text-accent" />
          <span>大纲</span>
          <ChevronLeft aria-hidden="true" className="size-3 text-ink-faint" />
        </button>
      </aside>
    );
  }

  return (
    <aside
      aria-label="文档大纲"
      className="fixed top-20 right-6 z-20 hidden w-56 transition-all duration-200 xl:block"
    >
      <div className="rounded-2xl border border-line/70 bg-card/85 p-3 shadow-card ring-1 ring-black/[0.02] backdrop-blur-md dark:ring-white/[0.04]">
        <div className="flex items-center justify-between border-b border-line/50 pb-2 text-xs font-semibold text-ink">
          <span className="flex items-center gap-1.5">
            <ListTree aria-hidden="true" className="size-3.5 text-accent" />
            <span>大纲目录</span>
          </span>
          <button
            type="button"
            title="收起大纲"
            aria-label="收起大纲"
            className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-normal text-ink-faint transition-colors hover:bg-overlay hover:text-ink"
            onClick={() => {
              handleSetExpanded(false);
            }}
          >
            <span>收起</span>
            <ChevronRight aria-hidden="true" className="size-3" />
          </button>
        </div>

        <div className="mt-2.5 max-h-[calc(100vh-10rem)] overflow-y-auto">
          {headings.length === 0 ? (
            <p className="py-2 text-[11px] leading-relaxed text-ink-faint">
              在正文中使用标题（H1-H3）后，这里会自动生成大纲目录。
            </p>
          ) : (
            <nav aria-label="大纲目录树">
              <ul className="space-y-0.5 border-l border-line/60">
                {headings.map((heading) => {
                  const isActive = activeHeadingId === heading.id;

                  return (
                    <li key={heading.id}>
                      <button
                        type="button"
                        style={{
                          paddingLeft: `${(heading.level - 1) * 0.75 + 0.625}rem`,
                        }}
                        className={`group -ml-px flex w-full items-center rounded-r-md border-l-2 py-1 text-left text-xs transition-colors ${
                          isActive
                            ? 'border-accent bg-accent-soft/50 font-medium text-accent'
                            : 'border-transparent text-ink-muted hover:border-accent hover:bg-overlay/60 hover:text-ink'
                        }`}
                        onClick={() => {
                          scrollToHeading(heading.pos);
                        }}
                      >
                        <span className="truncate">{heading.text}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </nav>
          )}
        </div>
      </div>
    </aside>
  );
}
