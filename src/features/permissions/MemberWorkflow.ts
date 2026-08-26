import type { AuditLogMetadata } from '@/features/audit-logs/AuditLog';
import type { RecordAuditLogOptions } from '@/features/audit-logs/server/RecordAuditLog';
import { MEMBER_INVITATION_LIFETIME_MS } from './MemberInvitation';

export const getMemberInvitationExpiration = (now = new Date()) =>
  new Date(now.getTime() + MEMBER_INVITATION_LIFETIME_MS);

export const isMemberInvitationExpired = (expiresAt: Date, now = new Date()) => expiresAt <= now;

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
