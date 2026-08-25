'use client';

import { Copy, Download, FileDown, Printer } from 'lucide-react';
import { useState } from 'react';
import { popupMenuItemClassName, PopupMenu, PopupMenuLabel } from '@/components/ui/PopupMenu';
import { useToast } from '@/components/ui/Toast';
import type { DocumentContent } from '../Document';
import { proseMirrorToMarkdown } from '../DocumentMarkdown';

/**
 * Dropdown export menu offering Markdown file download, clipboard copy, and native print.
 *
 * @param props - Current document content reader and title.
 * @returns The export action button and dropdown menu.
 */
export function DocumentExportMenu(props: {
  getContent: () => DocumentContent | null | undefined;
  title: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const toast = useToast();

  const handleDownloadMarkdown = () => {
    setIsOpen(false);
    try {
      const markdown = proseMirrorToMarkdown(props.getContent(), props.title);
      const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      const filename = `${props.title.trim() || 'document'}.md`;

      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(url);
      toast.success('已导出 Markdown 文件');
    } catch {
      toast.error('导出失败，请重试');
    }
  };

  const handleCopyMarkdown = async () => {
    setIsOpen(false);
    try {
      const markdown = proseMirrorToMarkdown(props.getContent(), props.title);
      await navigator.clipboard.writeText(markdown);
      toast.success('已复制 Markdown 内容到剪贴板');
    } catch {
      toast.error('复制失败，请重试');
    }
  };

  const handlePrint = () => {
    setIsOpen(false);
    window.print();
  };

  return (
    <div className="relative">
      <button
        type="button"
        aria-controls="document-export-menu"
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-label="导出与分享文档"
        title="导出文档"
        className="grid size-7 place-items-center rounded-lg text-ink-muted transition-colors hover:bg-overlay hover:text-ink active:scale-95"
        onClick={() => {
          setIsOpen((open) => !open);
        }}
      >
        <FileDown aria-hidden="true" className="size-4" strokeWidth={1.8} />
      </button>

      <PopupMenu
        id="document-export-menu"
        isOpen={isOpen}
        label="导出选项"
        placement={{ kind: 'anchor', side: 'bottom' }}
        surfaceClassName="right-0 left-auto w-48 p-1"
      >
        <PopupMenuLabel>导出与分享</PopupMenuLabel>
        <button type="button" className={popupMenuItemClassName} onClick={handleDownloadMarkdown}>
          <Download aria-hidden="true" className="size-3.5 text-accent" strokeWidth={1.8} />
          <span>导出为 Markdown (.md)</span>
        </button>
        <button type="button" className={popupMenuItemClassName} onClick={handleCopyMarkdown}>
          <Copy aria-hidden="true" className="size-3.5 text-ink-muted" strokeWidth={1.8} />
          <span>复制 Markdown 正文</span>
        </button>
        <div className="my-0.5 border-t border-line" />
        <button type="button" className={popupMenuItemClassName} onClick={handlePrint}>
          <Printer aria-hidden="true" className="size-3.5 text-ink-muted" strokeWidth={1.8} />
          <span>打印 / 导出为 PDF</span>
        </button>
      </PopupMenu>
    </div>
  );
}
