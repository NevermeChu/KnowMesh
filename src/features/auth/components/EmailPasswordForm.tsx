'use client';

import { Eye, EyeOff, LockKeyhole, Mail, UserRound } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { getFormText } from '@/features/auth/AuthForm';
import { authClient } from '@/libs/AuthClient';
import {
  createAuthenticationPageUrl,
  createRegistrationSuccessRedirect,
} from '@/utils/AuthenticationRedirect';

function getAuthenticationErrorMessage(code: string | undefined) {
  if (code === 'INVALID_EMAIL_OR_PASSWORD') {
    return '邮箱或密码不正确';
  }
  if (code === 'EMAIL_NOT_VERIFIED') {
    return '请先完成邮箱验证，我们已重新发送验证邮件';
  }
  if (code === 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL') {
    return '该邮箱已注册，请直接登录';
  }

  return '操作失败，请稍后重试';
}

/**
 * Renders the Better Auth email-password sign-in or sign-up form.
 *
 * @param props - Form mode and validated local redirect target.
 * @returns The authentication form or verification confirmation.
 */
export function EmailPasswordForm(props: { mode: 'sign-in' | 'sign-up'; redirectUrl: string }) {
  const [error, setError] = useState<string>();
  const [isPending, setIsPending] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);
  const alternatePage = props.mode === 'sign-in' ? '/sign-up' : '/sign-in';
  const alternatePageUrl = createAuthenticationPageUrl(alternatePage, props.redirectUrl);

  async function submit(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setIsPending(true);
    const formData = new FormData(event.currentTarget);
    const email = getFormText(formData, 'email').trim().toLowerCase();
    const password = getFormText(formData, 'password');

    const result =
      props.mode === 'sign-in'
        ? await authClient.signIn.email({ callbackURL: props.redirectUrl, email, password })
        : await authClient.signUp.email({
            callbackURL: createRegistrationSuccessRedirect(props.redirectUrl),
            email,
            name: getFormText(formData, 'name').trim(),
            password,
          });

    if (result.error) {
      setError(getAuthenticationErrorMessage(result.error.code));
      setIsPending(false);
      return;
    }

    if (props.mode === 'sign-up') {
      setVerificationSent(true);
      setIsPending(false);
      return;
    }

    window.location.assign(props.redirectUrl);
  }

  if (verificationSent) {
    return (
      <div className="rounded-2xl border border-accent/20 bg-accent-soft p-5 text-sm leading-6 text-ink-muted">
        <div className="mb-4 grid size-11 place-items-center rounded-xl bg-card text-accent shadow-card">
          <Mail className="size-5" strokeWidth={1.8} />
        </div>
        <p className="font-semibold text-ink">账号已创建</p>
        <p className="mt-1">验证邮件已发送。打开邮件中的链接后将自动登录，并返回刚才的页面。</p>
        <Link
          className="mt-4 inline-flex font-semibold text-accent transition-colors hover:text-accent-strong"
          href={alternatePageUrl}
        >
          返回登录
        </Link>
      </div>
    );
  }

  let submitLabel = props.mode === 'sign-in' ? '登录' : '创建账号';
  if (isPending) {
    submitLabel = '请稍候…';
  }

  return (
    <form className="space-y-4" method="post" onSubmit={submit}>
      {props.mode === 'sign-up' && (
        <FormField htmlFor="name" label="姓名" reserveErrorSpace={false} required>
          <div className="relative">
            <UserRound
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3.5 size-4.5 -translate-y-1/2 text-ink-faint"
              strokeWidth={1.8}
            />
            <Input
              autoComplete="name"
              className="h-11 rounded-xl bg-surface/70 pr-4 pl-10"
              id="name"
              name="name"
              placeholder="你的姓名"
              required
            />
          </div>
        </FormField>
      )}
      <FormField htmlFor="email" label="邮箱" reserveErrorSpace={false} required>
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
      <FormField
        htmlFor="password"
        label="密码"
        hint={props.mode === 'sign-up' ? '至少 8 个字符' : undefined}
        reserveErrorSpace={false}
        required
      >
        <div className="relative">
          <LockKeyhole
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3.5 size-4.5 -translate-y-1/2 text-ink-faint"
            strokeWidth={1.8}
          />
          <Input
            autoComplete={props.mode === 'sign-in' ? 'current-password' : 'new-password'}
            className="h-11 rounded-xl bg-surface/70 pr-11 pl-10"
            id="password"
            name="password"
            placeholder="输入密码"
            required
            type={isPasswordVisible ? 'text' : 'password'}
          />
          <button
            aria-label={isPasswordVisible ? '隐藏密码' : '显示密码'}
            className="absolute top-1/2 right-2.5 grid size-8 -translate-y-1/2 cursor-pointer place-items-center rounded-lg text-ink-faint transition-colors hover:bg-overlay hover:text-ink"
            onClick={() => {
              setIsPasswordVisible((isVisible) => !isVisible);
            }}
            type="button"
          >
            {isPasswordVisible ? (
              <EyeOff className="size-4.5" strokeWidth={1.8} />
            ) : (
              <Eye className="size-4.5" strokeWidth={1.8} />
            )}
          </button>
        </div>
      </FormField>
      {props.mode === 'sign-in' && (
        <div className="text-right text-sm">
          <Link
            className="font-medium text-accent transition-colors hover:text-accent-strong"
            href="/forgot-password"
          >
            忘记密码？
          </Link>
        </div>
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
      <p className="pt-1 text-center text-sm text-ink-muted">
        {props.mode === 'sign-in' ? '还没有账号？' : '已经有账号？'}{' '}
        <Link
          className="font-semibold text-accent transition-colors hover:text-accent-strong"
          href={alternatePageUrl}
        >
          {props.mode === 'sign-in' ? '立即注册' : '返回登录'}
        </Link>
      </p>
    </form>
  );
}
