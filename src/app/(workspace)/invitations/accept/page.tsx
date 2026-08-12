import { AcceptWorkspaceInvitation } from '@/features/workspaces/components/AcceptWorkspaceInvitation';

export default async function AcceptInvitationPage(props: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await props.searchParams;

  if (!token) {
    return <p className="py-20 text-sm text-[#b52e2e]">邀请链接缺少令牌。</p>;
  }

  return <AcceptWorkspaceInvitation token={token} />;
}
