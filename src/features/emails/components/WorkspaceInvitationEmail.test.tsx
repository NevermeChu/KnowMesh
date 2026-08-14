import { render } from '@react-email/render';
import { describe, expect, it } from 'vitest';
import { WorkspaceInvitationEmail } from './WorkspaceInvitationEmail';

describe(WorkspaceInvitationEmail, () => {
  it('renders invitation details and acceptance link', async () => {
    const html = await render(
      <WorkspaceInvitationEmail
        acceptUrl="https://knowmesh.example/invitations/accept?token=token_123"
        invitation={{
          expiresAtLabel: '2026年8月21日 12:00',
          inviteeEmail: 'member@example.com',
          inviterName: '林智',
          roleLabel: 'Viewer',
          workspaceName: '产品知识库',
        }}
      />,
    );

    expect(html).toContain('林智');
    expect(html).toContain('产品知识库');
    expect(html).toContain('member@example.com');
    expect(html).toContain('https://knowmesh.example/invitations/accept?token=token_123');
  });
});
