'use client';

import type { Editor } from '@tiptap/react';
import { EditorContent } from '@tiptap/react';
import { useRouter } from 'next/navigation';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { WorkspaceContent } from '@/components/layout/WorkspaceContent';
import { ContextMenu, fitContextMenuPosition } from '@/components/ui/ContextMenu';
import type { Document } from '../Document';
import { isDocumentContent } from '../DocumentSchema';
import { updateDocument } from '../server/UpdateDocument';
import { DocumentBlockHandle } from './DocumentBlockHandle';
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
  localPersistenceFailed?: boolean;
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
  const hasTitleConflict = useRef(false);
  const titleVersion = useRef(props.document.titleVersion);
  const applyRemoteTitle = useEffectEvent(() => {
    if (props.document.titleVersion <= titleVersion.current) {
      return;
    }

    titleVersion.current = props.document.titleVersion;
    if (title === lastSavedTitle.current) {
      lastSavedTitle.current = props.document.title;
      setTitle(props.document.title);
      return;
    }

    hasTitleConflict.current = true;
    props.setSaveState('conflict');
  });
  useEffect(() => {
    applyRemoteTitle();
  }, [props.document.title, props.document.titleVersion]);
  const saveTitle = async () => {
    if (hasTitleConflict.current) {
      props.setSaveState('conflict');
      return;
    }

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
      const result = await updateDocument({
        documentId: props.document.id,
        expectedTitleVersion: titleVersion.current,
        title: normalizedTitle,
      });
      if (result.status === 'conflict') {
        hasTitleConflict.current = true;
        props.setSaveState('conflict');
        return;
      }
      titleVersion.current = result.titleVersion;
      lastSavedTitle.current = normalizedTitle;
      hasTitleConflict.current = false;
      props.setSaveState('saved');
      router.refresh();
    } catch {
      props.setSaveState('error');
    }
  };
  const flushTitleForLifecycle = useEffectEvent(() => {
    if (!hasTitleConflict.current) {
      void saveTitle();
    }
  });
  const hasPendingTitle = useEffectEvent(() => title.trim() !== lastSavedTitle.current);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && hasPendingTitle()) {
        flushTitleForLifecycle();
      }
    };
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasPendingTitle()) {
        return;
      }

      flushTitleForLifecycle();
      event.preventDefault();
      Reflect.set(event, 'returnValue', true);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      if (hasPendingTitle()) {
        flushTitleForLifecycle();
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

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
              localPersistenceFailed={props.localPersistenceFailed}
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
            <DocumentExportMenu
              getContent={() => {
                const content = props.editor?.getJSON();
                return isDocumentContent(content) ? content : props.document.content;
              }}
              title={title}
            />
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
            <DocumentBlockHandle editor={props.editor} />
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
