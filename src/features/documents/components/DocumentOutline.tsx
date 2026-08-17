'use client';

import { useEditorState } from '@tiptap/react';
import type { Editor } from '@tiptap/react';
import { ChevronLeft, ChevronRight, ListTree } from 'lucide-react';
import { useState } from 'react';

export type OutlineHeading = {
  id: string;
  level: number;
  pos: number;
  text: string;
};

/**
 * Extracts headings from the active Tiptap editor instance.
 *
 * @param editor - The active Tiptap editor instance.
 * @returns Headings array.
 */
function extractHeadings(editor: Editor | null): OutlineHeading[] {
  if (!editor || editor.isDestroyed) {
    return [];
  }

  const headings: OutlineHeading[] = [];

  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === 'heading') {
      const text = node.textContent.trim();
      const level = typeof node.attrs.level === 'number' ? node.attrs.level : 1;

      if (text) {
        headings.push({
          id: `heading-${pos}`,
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
 * Renders the document outline (TOC) with subtle frosted glass effect.
 *
 * @param props - Active Tiptap editor.
 * @returns The document outline widget.
 */
export function DocumentOutline(props: { editor: Editor | null }) {
  const [isExpanded, setIsExpanded] = useState(true);

  const headings =
    useEditorState({
      editor: props.editor,
      selector: (ctx) => extractHeadings(ctx.editor),
    }) ?? [];

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
      <aside aria-label="文档大纲" className="hidden shrink-0 xl:block">
        <div className="sticky top-20">
          <button
            type="button"
            title="展开大纲目录"
            aria-label="展开大纲目录"
            className="hover:border-line-strong flex items-center gap-1.5 rounded-xl border border-line/70 bg-card/75 px-3 py-1.5 text-xs font-medium text-ink-muted shadow-card backdrop-blur-md transition-all hover:bg-card hover:text-ink active:scale-95"
            onClick={() => {
              setIsExpanded(true);
            }}
          >
            <ListTree aria-hidden="true" className="size-3.5 text-accent" />
            <span>大纲</span>
            <ChevronLeft aria-hidden="true" className="size-3 text-ink-faint" />
          </button>
        </div>
      </aside>
    );
  }

  return (
    <aside
      aria-label="文档大纲"
      className="hidden w-56 shrink-0 transition-all duration-200 xl:block"
    >
      <div className="sticky top-20 rounded-2xl border border-line/70 bg-card/75 p-3 shadow-card ring-1 ring-black/[0.02] backdrop-blur-md dark:ring-white/[0.04]">
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
              setIsExpanded(false);
            }}
          >
            <span>收起</span>
            <ChevronRight aria-hidden="true" className="size-3" />
          </button>
        </div>

        <div className="mt-2.5 max-h-[calc(100vh-12rem)] overflow-y-auto">
          {headings.length === 0 ? (
            <p className="py-2 text-[11px] leading-relaxed text-ink-faint">
              在正文中使用标题（H1-H3）后，这里会自动生成大纲目录。
            </p>
          ) : (
            <nav aria-label="大纲目录树">
              <ul className="space-y-0.5 border-l border-line/60">
                {headings.map((heading) => (
                  <li key={heading.id}>
                    <button
                      type="button"
                      style={{
                        paddingLeft: `${(heading.level - 1) * 0.75 + 0.625}rem`,
                      }}
                      className="group -ml-px flex w-full items-center rounded-r-md border-l-2 border-transparent py-1 text-left text-xs text-ink-muted transition-colors hover:border-accent hover:bg-overlay/60 hover:text-ink"
                      onClick={() => {
                        scrollToHeading(heading.pos);
                      }}
                    >
                      <span className="truncate transition-colors group-hover:text-accent">
                        {heading.text}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </nav>
          )}
        </div>
      </div>
    </aside>
  );
}
