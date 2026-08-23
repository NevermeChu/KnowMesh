'use client';

import type { Editor } from '@tiptap/react';
import { EditorContent } from '@tiptap/react';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { WorkspaceContent } from '@/components/layout/WorkspaceContent';
import { ContextMenu, fitContextMenuPosition } from '@/components/ui/ContextMenu';
import type { Document } from '../Document';
import { isDocumentContent } from '../DocumentSchema';
import { updateDocument } from '../server/UpdateDocument';
import { DocumentBubbleMenu } from './DocumentBubbleMenu';
import {
  useDocumentEditorCommands,
  useDocumentEditorToolbarRegistration,
} from './DocumentEditorToolbar';
import { DocumentExportMenu } from './DocumentExportMenu';
import { DocumentOutline } from './DocumentOutline';
import type { DocumentCollaborationMember } from './DocumentPresence';
import { DocumentPresence } from './DocumentPresence';
import type { CollaborationState, SaveState } from './DocumentSaveStatus';
import { DocumentSaveStatus } from './DocumentSaveStatus';
import { DocumentSlashMenu } from './DocumentSlashMenu';
import { StarDocumentButton } from './StarDocumentButton';

export function DocumentEditorSurface(props: {
  canEditContent: boolean;
  canEditTitle: boolean;
  collaborationMembers?: DocumentCollaborationMember[];
  collaborationState?: CollaborationState;
  document: Document;
  editor: Editor | null;
  saveState: SaveState;
  setSaveState: (state: SaveState) => void;
  wordCount: number;
}) {
  const router = useRouter();
  const toolbarRegistration = useDocumentEditorToolbarRegistration();
  const editorCommands = useDocumentEditorCommands();
  const [title, setTitle] = useState(props.document.title);
  const [contextMenuPosition, setContextMenuPosition] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [isOutlineExpanded, setIsOutlineExpanded] = useState(true);
  const lastSavedTitle = useRef(props.document.title);
  const currentContent = props.editor?.getJSON();
  const exportContent = isDocumentContent(currentContent) ? currentContent : props.document.content;

  const saveTitle = async () => {
    const normalizedTitle = title.trim();

    if (!normalizedTitle) {
      setTitle(lastSavedTitle.current);
      props.setSaveState('error');
      return;
    }

    if (normalizedTitle === lastSavedTitle.current) {
      setTitle(normalizedTitle);
      return;
    }

    setTitle(normalizedTitle);
    props.setSaveState('saving');

    try {
      await updateDocument({ documentId: props.document.id, title: normalizedTitle });
      lastSavedTitle.current = normalizedTitle;
      props.setSaveState('saved');
      router.refresh();
    } catch {
      props.setSaveState('error');
    }
  };

  return (
    <div className="relative py-8">
      <WorkspaceContent
        as="article"
        className={`transition-[padding] duration-200 ease-out ${
          isOutlineExpanded ? 'xl:pr-64 2xl:pr-0' : 'xl:pr-0'
        }`}
      >
        <div className="flex min-h-6 items-center justify-between gap-4 text-xs text-ink-faint">
          <div className="flex min-w-0 items-center gap-2.5">
            <DocumentSaveStatus
              canEdit={props.canEditContent}
              collaborationState={props.collaborationState}
              state={props.saveState}
            />
            {props.collaborationMembers && (
              <DocumentPresence members={props.collaborationMembers} />
            )}
            <span aria-hidden="true" className="text-line">
              ·
            </span>
            <span className="text-xs font-medium text-ink-faint">
              {props.wordCount} 字 · 约 {Math.max(1, Math.ceil(props.wordCount / 300))} 分钟阅读
            </span>
            <span aria-hidden="true" className="text-line">
              ·
            </span>
            <StarDocumentButton
              documentId={props.document.id}
              initialIsStarred={props.document.isStarred}
            />
            <span aria-hidden="true" className="text-line">
              ·
            </span>
            <DocumentExportMenu content={exportContent} title={title} />
          </div>
        </div>

        <input
          aria-label="文档标题"
          className="mt-5 w-full bg-transparent text-4xl font-bold tracking-tight text-ink outline-none placeholder:text-ink-faint-strong disabled:opacity-100"
          disabled={!props.canEditTitle}
          maxLength={200}
          placeholder="无标题"
          value={title}
          onBlur={() => {
            void saveTitle();
          }}
          onChange={(event) => {
            setTitle(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              event.currentTarget.blur();
              props.editor?.commands.focus('start');
            }
          }}
        />

        <div
          onContextMenu={(event) => {
            if (!editorCommands) {
              return;
            }

            event.preventDefault();
            event.stopPropagation();
            setContextMenuPosition(
              fitContextMenuPosition({
                itemCount: editorCommands.length,
                x: event.clientX,
                y: event.clientY,
              }),
            );
          }}
        >
          <EditorContent editor={props.editor} />
        </div>

        {props.canEditContent && (
          <>
            <DocumentBubbleMenu
              editor={props.editor}
              onOpenLinkEditor={toolbarRegistration.openLinkEditor}
            />
            <DocumentSlashMenu editor={props.editor} />
          </>
        )}

        <ContextMenu
          id="document-format-context-menu"
          items={editorCommands ?? []}
          label="文档格式"
          position={contextMenuPosition}
          onClose={() => {
            setContextMenuPosition(null);
          }}
        />
      </WorkspaceContent>

      <DocumentOutline
        editor={props.editor}
        isExpanded={isOutlineExpanded}
        onToggleExpanded={setIsOutlineExpanded}
      />
    </div>
  );
}
