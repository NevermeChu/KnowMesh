'use client';

import { Link2 } from 'lucide-react';
import { useState } from 'react';
import { ModalDialog, ModalDialogHeader } from '@/components/ui/ModalDialog';

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
        className="space-y-4 px-5 py-4"
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
        <div>
          <label htmlFor="document-link-href" className="block text-sm font-medium text-[#45494e]">
            链接地址
          </label>
          <input
            autoFocus
            required
            id="document-link-href"
            aria-label="链接地址"
            className="mt-2 w-full rounded-lg border border-black/12 px-3 py-2 text-sm transition-colors outline-none placeholder:text-[#a0a3a7] focus:border-[#2383e2]"
            placeholder="https://example.com"
            value={href}
            onChange={(event) => {
              setHref(event.target.value);
            }}
          />
        </div>
        <div className="flex items-center justify-between gap-3">
          <div>
            {props.href !== 'https://' && (
              <button
                type="button"
                className="rounded-lg px-3 py-2 text-sm font-medium text-[#b52e2e] transition-colors hover:bg-[#d14343]/8"
                onClick={props.onRemove}
              >
                移除链接
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded-lg px-3.5 py-2 text-sm font-medium text-[#666a70] transition-colors hover:bg-black/5 hover:text-[#202124]"
              onClick={props.onClose}
            >
              取消
            </button>
            <button
              type="submit"
              className="rounded-lg bg-[#2383e2] px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#1b6fbd]"
            >
              保存
            </button>
          </div>
        </div>
      </form>
    </ModalDialog>
  );
}
