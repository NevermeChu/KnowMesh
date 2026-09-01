import { describe, expect, it } from 'vitest';
import {
  createMemberAuditContext,
  getMemberInvitationExpiration,
  isFailedMemberAction,
  isMemberInvitationExpired,
  memberActionErrorMessage,
  runMemberAction,
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
  it('expires invitations at or before the current time', () => {
    const now = new Date('2026-08-26T00:00:00.000Z');

    expect(isMemberInvitationExpired(now, now)).toBeTruthy();
    expect(isMemberInvitationExpired(new Date('2026-08-26T00:00:00.001Z'), now)).toBeFalsy();
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

describe(runMemberAction, () => {
  it('returns success when the mutation completes', async () => {
    await expect(
      runMemberAction(async () => {
        await Promise.resolve();
      }),
    ).resolves.toStrictEqual({
      ok: true,
    });
  });

  it('returns the error message instead of throwing', async () => {
    await expect(
      runMemberAction(async () => {
        await Promise.resolve();
        throw new Error('权限申请不存在');
      }),
    ).resolves.toStrictEqual({ error: '权限申请不存在', ok: false });
  });
});

describe(memberActionErrorMessage, () => {
  it('uses the Error message or a generic fallback', () => {
    expect(memberActionErrorMessage(new Error('权限申请不存在'))).toBe('权限申请不存在');
    expect(memberActionErrorMessage('failed')).toBe('操作失败，请重试');
  });
});

describe(isFailedMemberAction, () => {
  it('accepts a failed membership action result', () => {
    expect(isFailedMemberAction({ error: '权限申请不存在', ok: false })).toBeTruthy();
  });

  it('rejects values that are not failed membership results', () => {
    expect(isFailedMemberAction({ ok: true })).toBeFalsy();
    expect(isFailedMemberAction({ workspaceId: 'workspace' })).toBeFalsy();
    expect(isFailedMemberAction(null)).toBeFalsy();
    expect(isFailedMemberAction('error')).toBeFalsy();
    expect(isFailedMemberAction({ error: 1, ok: false })).toBeFalsy();
  });

  it('rejects a false ok flag without an error message', () => {
    expect(isFailedMemberAction({ ok: false })).toBeFalsy();
  });
});
