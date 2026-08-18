'use client';

import { CheckCircle2, LockKeyhole, Mail } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { getFormText } from '@/features/auth/AuthForm';
import { authClient } from '@/libs/AuthClient';

/**
 * Renders the request or completion step of Better Auth password recovery.
 *
 * @param props - Optional reset token from the emailed URL.
 * @returns The password recovery form or completion state.
 */
export function PasswordRecoveryForm(props: { token?: string }) {
  const [error, setError] = useState<string>();
  const [isPending, setIsPending] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  async function submit(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setIsPending(true);
    const formData = new FormData(event.currentTarget);
    const result = props.token
      ? await authClient.resetPassword({
          newPassword: getFormText(formData, 'password'),
          token: props.token,
        })
      : await authClient.requestPasswordReset({
          email: getFormText(formData, 'email').trim().toLowerCase(),
          redirectTo: '/reset-password',
        });

    if (result.error) {
      setError(props.token ? '链接无效或已过期，请重新申请' : '发送失败，请稍后重试');
      setIsPending(false);
      return;
    }

    setIsComplete(true);
    setIsPending(false);
  }

  if (isComplete) {
    return (
      <div className="rounded-2xl border border-accent/20 bg-accent-soft p-5 text-sm leading-6 text-ink-muted">
        <CheckCircle2 className="mb-3 size-6 text-accent" strokeWidth={1.8} />
        <p className="font-semibold text-ink">{props.token ? '密码已更新' : '重置邮件已发送'}</p>
        <p className="mt-1">
          {props.token ? '现在可以使用新密码登录。' : '如果该邮箱存在账户，你将收到密码重置邮件。'}
        </p>
        <Link className="mt-4 inline-flex font-semibold text-accent" href="/sign-in">
          返回登录
        </Link>
      </div>
    );
  }

  let submitLabel = props.token ? '更新密码' : '发送重置邮件';
  if (isPending) {
    submitLabel = '请稍候…';
  }

  return (
    <form className="space-y-4" onSubmit={submit}>
      {props.token ? (
        <FormField htmlFor="password" label="新密码" hint="至少 8 个字符" required>
          <div className="relative">
            <LockKeyhole
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3.5 size-4.5 -translate-y-1/2 text-ink-faint"
              strokeWidth={1.8}
            />
            <Input
              autoComplete="new-password"
              className="h-11 rounded-xl bg-surface/70 pr-4 pl-10"
              id="password"
              name="password"
              placeholder="输入新密码"
              required
              type="password"
            />
          </div>
        </FormField>
      ) : (
        <FormField htmlFor="email" label="注册邮箱" reserveErrorSpace={false} required>
          <div className="relative">
            <Mail
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3.5 size-4.5 -translate-y-1/2 text-ink-faint"
              strokeWidth={1.8}
            />
            <Input
              autoComplete="email"
              className="h-11 rounded-xl bg-surface/70 pr-4 pl-10"
              id="email"
              name="email"
              placeholder="name@company.com"
              required
              type="email"
            />
          </div>
        </FormField>
      )}
      {error && (
        <p
          className="rounded-xl border border-danger/20 bg-danger/5 px-3.5 py-2.5 text-sm text-danger"
          role="alert"
        >
          {error}
        </p>
      )}
      <Button
        className="h-11 w-full rounded-xl shadow-[0_10px_24px_-10px_rgb(35_131_226/0.8)]"
        disabled={isPending}
        size="lg"
        type="submit"
        variant="primary"
      >
        {submitLabel}
      </Button>
    </form>
  );
}
