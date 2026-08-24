import { AcceptWorkspaceInvitation } from '@/features/workspaces/components/AcceptWorkspaceInvitation';
import { getWorkspaceInvitation } from '@/features/workspaces/server/GetWorkspaceInvitation';

export default async function AcceptInvitationPage(props: {
  searchParams: Promise<{ registration?: string; token?: string; workspace?: string }>;
}) {
  const { registration, token, workspace } = await props.searchParams;
  const registrationSucceeded = registration === 'success';

  if (!token && !workspace) {
    return (
      <AcceptWorkspaceInvitation
        data={{ status: 'invalid' }}
        registrationSucceeded={registrationSucceeded}
        token=""
      />
    );
  }

  const data = await getWorkspaceInvitation({ token, workspaceId: workspace });

  return (
    <AcceptWorkspaceInvitation
      data={data}
      registrationSucceeded={registrationSucceeded}
      token={token}
      workspaceId={workspace}
    />
  );
}
