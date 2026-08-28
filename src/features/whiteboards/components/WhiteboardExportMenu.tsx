'use client';

import { exportToBlob, exportToSvg, getNonDeletedElements } from '@excalidraw/excalidraw';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import { Download, FileDown, FileImage } from 'lucide-react';
import { useState } from 'react';
import { popupMenuItemClassName, PopupMenu, PopupMenuLabel } from '@/components/ui/PopupMenu';
import { useToast } from '@/components/ui/Toast';
import type { WhiteboardScene } from '../WhiteboardScene';

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function WhiteboardExportMenu(props: {
  getApi: () => ExcalidrawImperativeAPI | null;
  getScene: () => WhiteboardScene;
  title: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const toast = useToast();
  const filename = props.title.trim() || 'whiteboard';

  const exportImage = async (format: 'png' | 'svg') => {
    setIsOpen(false);
    const api = props.getApi();
    if (!api) {
      toast.error('白板尚未准备完成');
      return;
    }

    try {
      const elements = getNonDeletedElements(api.getSceneElements());
      const appState = { ...api.getAppState(), exportBackground: true };
      if (format === 'png') {
        const blob = await exportToBlob({ appState, elements, files: {}, mimeType: 'image/png' });
        if (!(blob instanceof Blob)) {
          throw new Error('PNG export did not return a Blob');
        }
        downloadBlob(blob, `${filename}.png`);
      } else {
        const svg = await exportToSvg({ appState, elements, files: {} });
        if (!(svg instanceof SVGSVGElement)) {
          throw new Error('SVG export did not return an SVG element');
        }
        downloadBlob(
          new Blob([new XMLSerializer().serializeToString(svg)], {
            type: 'image/svg+xml;charset=utf-8',
          }),
          `${filename}.svg`,
        );
      }
      toast.success(`已导出 ${format.toUpperCase()} 文件`);
    } catch {
      toast.error('导出失败，请重试');
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        aria-controls="whiteboard-export-menu"
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-label="导出白板"
        title="导出白板"
        className="grid size-7 place-items-center rounded-lg text-ink-muted transition-colors hover:bg-overlay hover:text-ink active:scale-95"
        onClick={() => {
          setIsOpen((open) => !open);
        }}
      >
        <FileDown aria-hidden="true" className="size-4" strokeWidth={1.8} />
      </button>

      <PopupMenu
        id="whiteboard-export-menu"
        isOpen={isOpen}
        label="白板导出选项"
        placement={{ kind: 'anchor', side: 'bottom' }}
        surfaceClassName="right-0 left-auto w-52 p-1"
      >
        <PopupMenuLabel>导出白板</PopupMenuLabel>
        <button
          type="button"
          className={popupMenuItemClassName}
          onClick={() => {
            setIsOpen(false);
            downloadBlob(
              new Blob([JSON.stringify(props.getScene(), null, 2)], {
                type: 'application/vnd.excalidraw+json;charset=utf-8',
              }),
              `${filename}.excalidraw`,
            );
            toast.success('已导出 Excalidraw 文件');
          }}
        >
          <Download aria-hidden="true" className="size-3.5 text-accent" strokeWidth={1.8} />
          <span>导出 .excalidraw</span>
        </button>
        <button
          type="button"
          className={popupMenuItemClassName}
          onClick={() => {
            void exportImage('png');
          }}
        >
          <FileImage aria-hidden="true" className="size-3.5 text-ink-muted" strokeWidth={1.8} />
          <span>导出 PNG</span>
        </button>
        <button
          type="button"
          className={popupMenuItemClassName}
          onClick={() => {
            void exportImage('svg');
          }}
        >
          <FileImage aria-hidden="true" className="size-3.5 text-ink-muted" strokeWidth={1.8} />
          <span>导出 SVG</span>
        </button>
      </PopupMenu>
    </div>
  );
}
