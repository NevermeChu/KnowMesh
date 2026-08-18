'use client';

import { Link2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import {
  ModalDialog,
  ModalDialogBody,
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
          <FormField htmlFor="document-link-href" label="链接地址" reserveErrorSpace={false}>
            <Input
              autoFocus
              id="document-link-href"
              onChange={(event) => {
                setHref(event.target.value);
              }}
              placeholder="https://example.com"
              required
              value={href}
            />
          </FormField>
        </ModalDialogBody>
        <ModalDialogFooter alignment="between">
          <div>
            {props.href !== 'https://' && (
              <Button onClick={props.onRemove} type="button" variant="danger">
                移除链接
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button onClick={props.onClose} type="button">
              取消
            </Button>
            <Button type="submit" variant="primary">
              保存
            </Button>
          </div>
        </ModalDialogFooter>
      </form>
    </ModalDialog>
  );
}
