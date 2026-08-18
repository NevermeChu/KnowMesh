'use client';

import { Command, Keyboard, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { OPEN_SHORTCUTS_HELP_EVENT, openShortcutsHelp } from '@/components/layout/ShellEvents';
import { Kbd } from './Kbd';

export { OPEN_SHORTCUTS_HELP_EVENT, openShortcutsHelp };

type ShortcutRow = {
  description: string;
  keys: string[];
};

type ShortcutCategory = {
  shortcuts: ShortcutRow[];
  title: string;
};

const shortcutCategories: ShortcutCategory[] = [
  {
    shortcuts: [
      { description: '全局搜索 / 快捷指令面板', keys: ['⌘', 'K'] },
      { description: '打开快捷键指南', keys: ['⌘', '/'] },
      { description: '折叠 / 展开侧边栏', keys: ['⌘', '\\'] },
      { description: '切换全屏专注阅读模式', keys: ['⌘', '⇧', 'F'] },
      { description: '关闭弹窗 / 退出当前面板', keys: ['ESC'] },
    ],
    title: '全局控制',
  },
  {
    shortcuts: [
      { description: '加粗选中文本', keys: ['⌘', 'B'] },
      { description: '斜体选中文本', keys: ['⌘', 'I'] },
      { description: '添加删除线', keys: ['⌘', '⇧', 'X'] },
      { description: '行内代码标记', keys: ['⌘', 'E'] },
      { description: '插入超链接', keys: ['⌘', 'K'] },
      { description: '撤销上一步操作', keys: ['⌘', 'Z'] },
      { description: '重做下一步操作', keys: ['⌘', '⇧', 'Z'] },
    ],
    title: '文本样式',
  },
  {
    shortcuts: [
      { description: '唤起块插入 Slash 菜单', keys: ['/'] },
      { description: '切换一级 ~ 三级标题', keys: ['⌘', '⌥', '1-3'] },
      { description: '无序符号列表', keys: ['⌘', '⇧', '8'] },
      { description: '有序数字列表', keys: ['⌘', '⇧', '7'] },
      { description: '任务清单 (代办项)', keys: ['⌘', '⇧', '9'] },
      { description: '引用区块', keys: ['⌘', '⇧', 'B'] },
      { description: '多行代码块', keys: ['⌘', '⌥', 'C'] },
    ],
    title: '排版与区块',
  },
];

/**
 * Modal dialog presenting all global, editor, and navigation keyboard shortcuts.
 *
 * @returns The shortcuts help dialog portal.
 */
export function ShortcutsHelpDialog() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleOpen = () => {
      setIsOpen(true);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === '/') {
        event.preventDefault();
        setIsOpen((open) => !open);
        return;
      }

      if (event.key === '?' && !event.metaKey && !event.ctrlKey && !event.altKey) {
        const activeTag = document.activeElement?.tagName.toLowerCase();
        const isEditable = document.activeElement?.getAttribute('contenteditable') === 'true';

        if (
          activeTag !== 'input' &&
          activeTag !== 'textarea' &&
          activeTag !== 'select' &&
          !isEditable
        ) {
          event.preventDefault();
          setIsOpen(true);
        }
      }
    };

    window.addEventListener(OPEN_SHORTCUTS_HELP_EVENT, handleOpen);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener(OPEN_SHORTCUTS_HELP_EVENT, handleOpen);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  if (!isOpen || typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-90 flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop */}
      <button
        type="button"
        aria-label="关闭快捷键指南"
        className="animate-overlay-in absolute inset-0 size-full cursor-default bg-black/45 backdrop-blur-[3px]"
        onClick={() => {
          setIsOpen(false);
        }}
      />

      {/* Dialog Body */}
      <dialog
        open
        aria-modal="true"
        aria-label="键盘快捷键指南"
        className="animate-modal-in relative z-10 flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-line bg-card p-0 text-ink shadow-overlay"
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            setIsOpen(false);
          }
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <span className="grid size-8 place-items-center rounded-lg bg-accent-soft text-accent">
              <Keyboard aria-hidden="true" className="size-4" strokeWidth={2} />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-ink">键盘快捷键指南</h2>
              <p className="text-xs text-ink-faint">提升操作效率的全局与编辑器快捷键一览</p>
            </div>
          </div>
          <button
            type="button"
            aria-label="关闭"
            className="grid size-7 place-items-center rounded-lg text-ink-muted transition-colors hover:bg-overlay hover:text-ink"
            onClick={() => {
              setIsOpen(false);
            }}
          >
            <X aria-hidden="true" className="size-4" strokeWidth={1.8} />
          </button>
        </div>

        {/* Content grid */}
        <div className="flex-1 space-y-5 overflow-y-auto p-5 text-xs">
          {shortcutCategories.map((category) => (
            <section key={category.title}>
              <h3 className="mb-2 font-semibold tracking-wider text-ink-muted uppercase">
                {category.title}
              </h3>
              <div className="divide-y divide-line-soft rounded-xl border border-line/60 bg-surface/40">
                {category.shortcuts.map((shortcut) => (
                  <div
                    key={shortcut.description}
                    className="flex items-center justify-between px-3.5 py-2.5"
                  >
                    <span className="text-ink-secondary">{shortcut.description}</span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key) => (
                        <Kbd
                          key={key}
                          className="min-w-5 text-center font-medium text-ink shadow-xs"
                          surface="card"
                        >
                          {key}
                        </Kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>

        {/* Footer tip */}
        <div className="flex items-center justify-between border-t border-line bg-surface/30 px-5 py-2.5 text-[11px] text-ink-faint">
          <span className="flex items-center gap-1.5">
            <Command aria-hidden="true" className="size-3.5" />
            <span>Windows 用户请将 ⌘ 替换为 Ctrl，⌥ 替换为 Alt</span>
          </span>
          <span className="flex items-center gap-1">
            <Kbd surface="card">ESC</Kbd>
            <span>关闭</span>
          </span>
        </div>
      </dialog>
    </div>,
    document.body,
  );
}
