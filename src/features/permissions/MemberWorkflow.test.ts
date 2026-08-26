import { describe, expect, it } from 'vitest';
import {
  createMemberAuditContext,
  getMemberInvitationExpiration,
  isMemberInvitationExpired,
} from './MemberWorkflow';

describe(getMemberInvitationExpiration, () => {
  it('creates expiration seven days after issuance', () => {
    const issuedAt = new Date('2026-08-26T00:00:00.000Z');

    expect(getMemberInvitationExpiration(issuedAt)).toStrictEqual(
      new Date('2026-09-02T00:00:00.000Z'),
    );
  });
});

describe(isMemberInvitationExpired, () => {
  it('expires invitations at the boundary', () => {
    const now = new Date('2026-08-26T00:00:00.000Z');

    expect(isMemberInvitationExpired(now, now)).toBeTruthy();
  });

  it('keeps future invitations active', () => {
    expect(
      isMemberInvitationExpired(
        new Date('2026-08-26T00:00:00.001Z'),
        new Date('2026-08-26T00:00:00.000Z'),
      ),
    ).toBeFalsy();
  });
});

describe(createMemberAuditContext, () => {
  it('builds a stable membership target context', () => {
    expect(
      createMemberAuditContext({
        actorUserId: 'actor',
        metadata: { nextRole: 'editor', resourceName: 'Resource', targetUserId: 'target' },
        targetUserId: 'target',
        workspaceId: 'workspace',
      }),
    ).toStrictEqual({
      actorUserId: 'actor',
      metadata: { nextRole: 'editor', resourceName: 'Resource', targetUserId: 'target' },
      targetId: 'target',
      targetKind: 'member',
      workspaceId: 'workspace',
    });
  });
});
