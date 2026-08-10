'use client';

import { Link2 } from 'lucide-react';
import { useState } from 'react';
import {
  ModalDialog,
  ModalDialogBody,
  ModalDialogButton,
  ModalDialogFooter,
  ModalDialogHeader,
} from '@/components/ui/ModalDialog';

/**
 * Collects the URL used by the StarterKit link mark.
 *
 * @param props - Initial URL and link actions.
 * @returns The link editor dialog.
 */
export function DocumentLinkDialog(props: {
  href: string;
  onClose: () => void;
  onRemove: () => void;
  onSave: (href: string) => void;
}) {
  const [href, setHref] = useState(props.href);

  return (
    <ModalDialog
      dismissal={{ ariaLabel: '关闭链接编辑', onDismiss: props.onClose }}
      surfaceClassName="w-[min(30rem,calc(100vw-2rem))]"
      titleId="document-link-dialog-title"
    >
      <ModalDialogHeader
        closeButton={{ ariaLabel: '关闭链接编辑', onClick: props.onClose }}
        icon={<Link2 aria-hidden="true" className="size-5" strokeWidth={1.8} />}
        title={props.href === 'https://' ? '添加链接' : '编辑链接'}
        titleId="document-link-dialog-title"
      />
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const normalizedHref = href.trim();

          if (normalizedHref) {
            props.onSave(normalizedHref);
          } else {
            props.onRemove();
          }
        }}
      >
        <ModalDialogBody>
          <label htmlFor="document-link-href" className="block text-xs font-medium text-[#555a60]">
            链接地址
          </label>
          <input
            autoFocus
            required
            id="document-link-href"
            aria-label="链接地址"
            className="mt-1.5 h-9 w-full rounded-lg border border-black/12 bg-white px-3 text-sm transition-colors outline-none placeholder:text-[#b0b3b7] focus:border-[#2383e2] focus:ring-2 focus:ring-[#2383e2]/15"
            placeholder="https://example.com"
            value={href}
            onChange={(event) => {
              setHref(event.target.value);
            }}
          />
        </ModalDialogBody>
        <ModalDialogFooter alignment="between">
          <div>
            {props.href !== 'https://' && (
              <ModalDialogButton type="button" variant="danger" onClick={props.onRemove}>
                移除链接
              </ModalDialogButton>
            )}
          </div>
          <div className="flex gap-2">
            <ModalDialogButton type="button" onClick={props.onClose}>
              取消
            </ModalDialogButton>
            <ModalDialogButton type="submit" variant="primary">
              保存
            </ModalDialogButton>
          </div>
        </ModalDialogFooter>
      </form>
    </ModalDialog>
  );
}
