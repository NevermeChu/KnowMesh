import { AcceptWorkspaceInvitation } from '@/features/workspaces/components/AcceptWorkspaceInvitation';
import { getWorkspaceInvitation } from '@/features/workspaces/server/GetWorkspaceInvitation';

export default async function AcceptInvitationPage(props: {
  searchParams: Promise<{ registration?: string; token?: string }>;
}) {
  const { registration, token } = await props.searchParams;
  const registrationSucceeded = registration === 'success';

  if (!token) {
    return (
      <AcceptWorkspaceInvitation
        data={{ status: 'invalid' }}
        registrationSucceeded={registrationSucceeded}
        token=""
      />
    );
  }

  const data = await getWorkspaceInvitation({ token });

  return (
    <AcceptWorkspaceInvitation
      data={data}
      registrationSucceeded={registrationSucceeded}
      token={token}
    />
  );
}
