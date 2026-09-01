import type { AuditLogMetadata } from '@/features/audit-logs/AuditLog';
import type { RecordAuditLogOptions } from '@/features/audit-logs/server/RecordAuditLog';
import { MEMBER_INVITATION_LIFETIME_MS } from './MemberInvitation';

export const getMemberInvitationExpiration = (now = new Date()) =>
  new Date(now.getTime() + MEMBER_INVITATION_LIFETIME_MS);

export const isMemberInvitationExpired = (expiresAt: Date, now = new Date()) => expiresAt <= now;

export type MemberActionResult = { ok: true } | { ok: false; error: string };

/**
 * Converts an unknown mutation failure into a client-safe message.
 *
 * @param error - Caught value from a membership mutation.
 * @returns The Error message, or a generic fallback.
 */
export function memberActionErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : '操作失败，请重试';
}

/**
 * Narrows an action return value to a failed membership mutation result.
 *
 * @param result - Unknown server action return value.
 * @returns Whether the result is a failed membership action.
 */
export function isFailedMemberAction(result: unknown): result is { error: string; ok: false } {
  return (
    typeof result === 'object' &&
    result !== null &&
    'ok' in result &&
    result.ok === false &&
    'error' in result &&
    typeof result.error === 'string'
  );
}

/**
 * Runs a membership mutation and returns a serializable result instead of throwing.
 *
 * @param operation - Mutation that may throw business or authorization errors.
 * @returns Success, or a client-safe error message.
 */
export async function runMemberAction(operation: () => Promise<void>): Promise<MemberActionResult> {
  try {
    await operation();
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: memberActionErrorMessage(error),
    };
  }
}

export function createMemberAuditContext(options: {
  actorUserId: string;
  metadata: AuditLogMetadata;
  targetUserId: string;
  workspaceId: string;
}): Pick<
  RecordAuditLogOptions,
  'actorUserId' | 'metadata' | 'targetId' | 'targetKind' | 'workspaceId'
> {
  return {
    actorUserId: options.actorUserId,
    metadata: options.metadata,
    targetId: options.targetUserId,
    targetKind: 'member',
    workspaceId: options.workspaceId,
  };
}
