'use client';

import { useEditorState } from '@tiptap/react';
import type { Editor } from '@tiptap/react';
import {
  AlertTriangle,
  CheckCircle2,
  CheckSquare,
  ChevronDownSquare,
  FileCode,
  Heading1,
  Heading2,
  Heading3,
  Info,
  List,
  ListOrdered,
  Minus,
  Pilcrow,
  Quote,
  StickyNote,
} from 'lucide-react';
import type { CalloutType } from '../extensions/CalloutExtension';

export type SlashCommandItem = {
  category: '基础排版' | '进阶块' | '提示框';
  description: string;
  icon: React.ReactNode;
  id: string;
  keywords: string[];
  onSelect: (editor: Editor) => void;
  title: string;
};

const slashCommands: SlashCommandItem[] = [
  {
    category: '基础排版',
    description: '普通段落文本',
    icon: <Pilcrow aria-hidden="true" className="size-4" />,
    id: 'paragraph',
    keywords: ['p', 'paragraph', 'text', '正文', '段落'],
    onSelect: (editor) => {
      editor.chain().focus().setParagraph().run();
    },
    title: '正文',
  },
  {
    category: '基础排版',
    description: '大标题，用于章节主题',
    icon: <Heading1 aria-hidden="true" className="size-4" />,
    id: 'h1',
    keywords: ['h1', 'heading1', 'title', '一级标题', '大标题'],
    onSelect: (editor) => {
      editor.chain().focus().toggleHeading({ level: 1 }).run();
    },
    title: '一级标题',
  },
  {
    category: '基础排版',
    description: '中标题，用于主要小节',
    icon: <Heading2 aria-hidden="true" className="size-4" />,
    id: 'h2',
    keywords: ['h2', 'heading2', 'subtitle', '二级标题', '中标题'],
    onSelect: (editor) => {
      editor.chain().focus().toggleHeading({ level: 2 }).run();
    },
    title: '二级标题',
  },
  {
    category: '基础排版',
    description: '小标题，用于子项划分',
    icon: <Heading3 aria-hidden="true" className="size-4" />,
    id: 'h3',
    keywords: ['h3', 'heading3', '三级标题', '小标题'],
    onSelect: (editor) => {
      editor.chain().focus().toggleHeading({ level: 3 }).run();
    },
    title: '三级标题',
  },
  {
    category: '基础排版',
    description: '标准无序项目符号列表',
    icon: <List aria-hidden="true" className="size-4" />,
    id: 'bullet-list',
    keywords: ['bullet', 'list', 'ul', '无序列表', '列表'],
    onSelect: (editor) => {
      editor.chain().focus().toggleBulletList().run();
    },
    title: '无序列表',
  },
  {
    category: '基础排版',
    description: '带数字序号的项目列表',
    icon: <ListOrdered aria-hidden="true" className="size-4" />,
    id: 'ordered-list',
    keywords: ['ordered', 'number', 'ol', '有序列表', '序号'],
    onSelect: (editor) => {
      editor.chain().focus().toggleOrderedList().run();
    },
    title: '有序列表',
  },
  {
    category: '基础排版',
    description: '带复选框的交互式代办清单',
    icon: <CheckSquare aria-hidden="true" className="size-4" />,
    id: 'task-list',
    keywords: ['todo', 'task', 'checklist', '任务', '清单', '代办', '待办'],
    onSelect: (editor) => {
      editor.chain().focus().toggleTaskList().run();
    },
    title: '任务列表',
  },
  {
    category: '基础排版',
    description: '引用名言、参考出处或他人观点',
    icon: <Quote aria-hidden="true" className="size-4" />,
    id: 'quote',
    keywords: ['quote', 'blockquote', '引用'],
    onSelect: (editor) => {
      editor.chain().focus().toggleBlockquote().run();
    },
    title: '引用',
  },
  {
    category: '基础排版',
    description: '插入一条横向页面分割线',
    icon: <Minus aria-hidden="true" className="size-4" />,
    id: 'divider',
    keywords: ['divider', 'hr', 'line', '分割线', '横线'],
    onSelect: (editor) => {
      editor.chain().focus().setHorizontalRule().run();
    },
    title: '分割线',
  },
  {
    category: '进阶块',
    description: '带有背景的高亮折叠区块',
    icon: <ChevronDownSquare aria-hidden="true" className="size-4" />,
    id: 'details',
    keywords: ['toggle', 'details', 'collapse', 'accordion', '折叠', '折叠块'],
    onSelect: (editor) => {
      editor.chain().focus().insertDetails().run();
    },
    title: '折叠列表',
  },
  {
    category: '进阶块',
    description: '支持语法高亮的代码片段块',
    icon: <FileCode aria-hidden="true" className="size-4" />,
    id: 'code-block',
    keywords: ['code', 'codeblock', 'pre', '代码块', '代码'],
    onSelect: (editor) => {
      editor.chain().focus().toggleCodeBlock().run();
    },
    title: '代码块',
  },
  {
    category: '提示框',
    description: '蓝色信息提示框',
    icon: <Info aria-hidden="true" className="size-4 text-accent" />,
    id: 'callout-info',
    keywords: ['callout', 'info', 'notice', '提示', '信息', '提示框'],
    onSelect: (editor) => {
      editor
        .chain()
        .focus()
        .setCallout({ type: 'info' as CalloutType })
        .run();
    },
    title: '信息提示框',
  },
  {
    category: '提示框',
    description: '黄色警告与注意提示框',
    icon: <AlertTriangle aria-hidden="true" className="size-4 text-amber-500" />,
    id: 'callout-warning',
    keywords: ['warning', 'caution', 'alert', '警告', '注意'],
    onSelect: (editor) => {
      editor
        .chain()
        .focus()
        .setCallout({ type: 'warning' as CalloutType })
        .run();
    },
    title: '警告提示框',
  },
  {
    category: '提示框',
    description: '绿色成功与完成提示框',
    icon: <CheckCircle2 aria-hidden="true" className="size-4 text-emerald-500" />,
    id: 'callout-success',
    keywords: ['success', 'done', 'check', '成功', '完成'],
    onSelect: (editor) => {
      editor
        .chain()
        .focus()
        .setCallout({ type: 'success' as CalloutType })
        .run();
    },
    title: '成功提示框',
  },
  {
    category: '提示框',
    description: '深灰便签与备忘录提示框',
    icon: <StickyNote aria-hidden="true" className="size-4 text-ink-muted" />,
    id: 'callout-note',
    keywords: ['note', 'memo', 'tips', '便签', '备忘'],
    onSelect: (editor) => {
      editor
        .chain()
        .focus()
        .setCallout({ type: 'note' as CalloutType })
        .run();
    },
    title: '便签提示框',
  },
];

/**
 * Renders the slash command menu dropdown when typing "/" in the document.
 *
 * @param props - Active Tiptap editor.
 * @returns The slash commands popup menu.
 */
export function DocumentSlashMenu(props: { editor: Editor | null }) {
  const slashState = useEditorState({
    editor: props.editor,
    selector: (ctx) => {
      if (!ctx.editor || ctx.editor.isDestroyed || !ctx.editor.isEditable) {
        return null;
      }

      const { from, to } = ctx.editor.state.selection;
      if (from !== to) {
        return null;
      }

      const textBefore = ctx.editor.state.doc.textBetween(Math.max(0, from - 20), from, '\n');
      const slashMatch = textBefore.match(/(?:^|\s)\/([a-zA-Z0-9\u4E00-\u9FA5]*)$/u);

      if (slashMatch && slashMatch.index !== undefined) {
        const [matchText, currentQuery = ''] = slashMatch;
        const slashIndexInMatch = matchText.indexOf('/');
        const matchStart = Math.max(0, from - 20) + slashMatch.index + slashIndexInMatch;

        try {
          const coords = ctx.editor.view.coordsAtPos(from);
          const top = coords.bottom + 6;
          const left = Math.max(20, Math.min(window.innerWidth - 300, coords.left));

          return {
            currentQuery,
            position: { left, top },
            range: { from: matchStart, to: from },
          };
        } catch {
          return null;
        }
      }

      return null;
    },
  });

  if (!slashState || !props.editor) {
    return null;
  }

  const { editor } = props;
  const query = slashState.currentQuery;

  // Filter commands by query
  const filteredCommands = slashCommands.filter((cmd) => {
    if (!query) {
      return true;
    }
    const cleanQuery = query.toLowerCase().trim();
    return (
      cmd.title.toLowerCase().includes(cleanQuery) ||
      cmd.keywords.some((k) => k.toLowerCase().includes(cleanQuery))
    );
  });

  const selectCommand = (command: SlashCommandItem) => {
    if (!editor.isDestroyed) {
      editor
        .chain()
        .focus()
        .deleteRange({ from: slashState.range.from, to: slashState.range.to })
        .run();
      command.onSelect(editor);
    }
  };

  if (filteredCommands.length === 0) {
    return null;
  }

  return (
    <div
      role="menu"
      aria-label="快速插入块"
      className="animate-modal-in fixed z-50 max-h-72 w-64 overflow-y-auto rounded-xl border border-line bg-card p-1.5 shadow-overlay backdrop-blur-md"
      style={{
        left: `${slashState.position.left}px`,
        top: `${slashState.position.top}px`,
      }}
    >
      <div className="px-2 py-1 text-[11px] font-medium text-ink-faint">插入块</div>
      {filteredCommands.map((command) => (
        <button
          key={command.id}
          type="button"
          role="menuitem"
          className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-xs text-ink-secondary transition-colors hover:bg-overlay hover:text-ink"
          onClick={() => {
            selectCommand(command);
          }}
        >
          <span className="grid size-6 shrink-0 place-items-center rounded-md bg-surface text-ink">
            {command.icon}
          </span>
          <span className="min-w-0 flex-1 truncate">
            <span className="block truncate font-medium text-ink">{command.title}</span>
            <span className="block truncate text-[10px] text-ink-faint">{command.description}</span>
          </span>
        </button>
      ))}
    </div>
  );
}
