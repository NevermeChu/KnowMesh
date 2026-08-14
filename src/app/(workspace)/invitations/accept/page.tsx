import { AcceptWorkspaceInvitation } from '@/features/workspaces/components/AcceptWorkspaceInvitation';
import { getWorkspaceInvitation } from '@/features/workspaces/server/GetWorkspaceInvitation';

export default async function AcceptInvitationPage(props: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await props.searchParams;

  if (!token) {
    return <AcceptWorkspaceInvitation data={{ status: 'invalid' }} token="" />;
  }

  const data = await getWorkspaceInvitation({ token });

  return <AcceptWorkspaceInvitation data={data} token={token} />;
}
