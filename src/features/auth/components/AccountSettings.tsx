'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { getFormText } from '@/features/auth/AuthForm';
import type { AuthenticatedUser } from '@/features/auth/server/CurrentUser';
import { deleteAccount as deleteCurrentAccount } from '@/features/auth/server/DeleteAccount';
import { authClient } from '@/libs/AuthClient';

/**
 * Renders profile, password, and irreversible account controls.
 *
 * @param props - Current verified user details.
 * @returns The account settings sections.
 */
export function AccountSettings(props: { user: AuthenticatedUser }) {
  const [message, setMessage] = useState<string>();
  const [isPending, setIsPending] = useState(false);

  async function updateProfile(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsPending(true);
    setMessage(undefined);
    const formData = new FormData(event.currentTarget);
    const result = await authClient.updateUser({
      image: getFormText(formData, 'image').trim() || null,
      name: getFormText(formData, 'name').trim(),
    });
    setMessage(result.error ? '资料更新失败，请稍后重试' : '资料已更新');
    setIsPending(false);
  }

  async function changePassword(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsPending(true);
    setMessage(undefined);
    const formData = new FormData(event.currentTarget);
    const result = await authClient.changePassword({
      currentPassword: getFormText(formData, 'currentPassword'),
      newPassword: getFormText(formData, 'newPassword'),
      revokeOtherSessions: true,
    });
    setMessage(result.error ? '当前密码不正确或新密码不符合要求' : '密码已更新');
    setIsPending(false);
  }

  async function deleteAccount(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsPending(true);
    setMessage(undefined);
    const formData = new FormData(event.currentTarget);
    const result = await deleteCurrentAccount({
      password: getFormText(formData, 'deletePassword'),
    });

    if (!result.success) {
      setMessage(
        result.reason === 'team-workspace-owner'
          ? '请先转让所有团队工作区的所有权，再删除账户'
          : '账户删除失败，请检查密码后重试',
      );
      setIsPending(false);
      return;
    }

    await authClient.signOut();
    window.location.assign('/');
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 py-8">
      <header>
        <h1 className="text-2xl font-bold text-ink">账号设置</h1>
        <p className="mt-2 text-sm text-ink-muted">管理个人资料、密码和账户生命周期。</p>
      </header>

      <form
        className="space-y-3 rounded-xl border border-line bg-card p-6"
        onSubmit={updateProfile}
      >
        <h2 className="font-semibold text-ink">基本资料</h2>
        <FormField
          htmlFor="email"
          label="登录邮箱"
          hint={props.user.emailVerified ? '已验证' : '尚未验证'}
        >
          <Input disabled id="email" value={props.user.email} />
        </FormField>
        <FormField htmlFor="name" label="姓名" required>
          <Input defaultValue={props.user.name} id="name" name="name" required />
        </FormField>
        <FormField htmlFor="image" label="头像 URL" reserveErrorSpace={false}>
          <Input defaultValue={props.user.image ?? ''} id="image" name="image" type="url" />
        </FormField>
        <Button disabled={isPending} type="submit" variant="primary">
          保存资料
        </Button>
      </form>

      <form
        className="space-y-3 rounded-xl border border-line bg-card p-6"
        onSubmit={changePassword}
      >
        <h2 className="font-semibold text-ink">修改密码</h2>
        <FormField htmlFor="currentPassword" label="当前密码" required>
          <Input
            autoComplete="current-password"
            id="currentPassword"
            name="currentPassword"
            required
            type="password"
          />
        </FormField>
        <FormField htmlFor="newPassword" label="新密码" hint="至少 8 个字符" required>
          <Input
            autoComplete="new-password"
            id="newPassword"
            name="newPassword"
            required
            type="password"
          />
        </FormField>
        <Button disabled={isPending} type="submit" variant="secondary">
          更新密码
        </Button>
      </form>

      <form
        className="bg-danger-soft space-y-3 rounded-xl border border-danger/40 p-6"
        onSubmit={deleteAccount}
      >
        <h2 className="font-semibold text-danger">删除账户</h2>
        <p className="text-sm leading-6 text-ink-muted">
          Personal Workspace 和其中的 Project
          会永久删除；你将退出其他人的协作资源，保留文档中的创建者会被匿名化。删除前必须先转让所有
          Team Workspace 的所有权。
        </p>
        <FormField htmlFor="deletePassword" label="输入当前密码确认" required>
          <Input
            autoComplete="current-password"
            id="deletePassword"
            name="deletePassword"
            required
            type="password"
          />
        </FormField>
        <Button disabled={isPending} type="submit" variant="danger">
          永久删除账户
        </Button>
      </form>

      <output className="block min-h-5 text-sm text-ink-muted">{message}</output>
    </div>
  );
}
