'use client';

import { useState, useTransition } from 'react';
import type * as z from 'zod';
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
 * Renders the shared creation form for a resource identified by one name.
 *
 * @param props - Resource copy, name validation and creation callback.
 * @returns The shared resource creation dialog.
 */
export function CreateNamedResourceDialog(props: {
  closeAriaLabel: string;
  description: string;
  failureMessage: string;
  fieldId: string;
  fieldLabel: string;
  invalidNameMessage: string;
  maxLength: number;
  nameSchema: z.ZodType<string>;
  onClose: () => void;
  onCreate: (name: string) => Promise<void>;
  placeholder: string;
  title: string;
  titleId: string;
}) {
  const [error, setError] = useState<string>();
  const [name, setName] = useState('');
  const [isPending, startTransition] = useTransition();

  return (
    <ModalDialog
      dismissal={{
        ariaLabel: props.closeAriaLabel,
        isDisabled: isPending,
        onDismiss: props.onClose,
      }}
      surfaceClassName="w-full max-w-96"
      titleId={props.titleId}
    >
      <ModalDialogHeader
        closeButton={{ ariaLabel: '关闭', isDisabled: isPending, onClick: props.onClose }}
        description={props.description}
        title={props.title}
        titleId={props.titleId}
      />
      <form
        onSubmit={(event) => {
          event.preventDefault();
          setError(undefined);
          const result = props.nameSchema.safeParse(name);

          if (!result.success) {
            setError(result.error.issues[0]?.message ?? props.invalidNameMessage);
            return;
          }

          startTransition(async () => {
            try {
              await props.onCreate(result.data);
            } catch {
              setError(props.failureMessage);
            }
          });
        }}
      >
        <ModalDialogBody>
          <FormField error={error} htmlFor={props.fieldId} label={props.fieldLabel}>
            <Input
              autoComplete="off"
              autoFocus
              disabled={isPending}
              hasError={Boolean(error)}
              id={props.fieldId}
              maxLength={props.maxLength}
              onChange={(event) => {
                setName(event.target.value);
                if (error) {
                  setError(undefined);
                }
              }}
              placeholder={props.placeholder}
              value={name}
            />
          </FormField>
        </ModalDialogBody>
        <ModalDialogFooter>
          <Button disabled={isPending} onClick={props.onClose} type="button">
            取消
          </Button>
          <Button disabled={isPending} type="submit" variant="primary">
            {isPending ? '创建中…' : '创建'}
          </Button>
        </ModalDialogFooter>
      </form>
    </ModalDialog>
  );
}
