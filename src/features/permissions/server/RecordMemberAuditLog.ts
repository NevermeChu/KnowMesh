import 'server-only';
import { recordAuditLog } from '@/features/audit-logs/server/RecordAuditLog';
import type {
  AuditDatabase,
  RecordAuditLogOptions,
} from '@/features/audit-logs/server/RecordAuditLog';
import { createMemberAuditContext } from '@/features/permissions/MemberWorkflow';

export async function recordMemberAuditLog(
  database: AuditDatabase,
  options: Pick<RecordAuditLogOptions, 'action' | 'actorUserId' | 'metadata' | 'workspaceId'> & {
    targetUserId: string;
  },
) {
  await recordAuditLog(database, {
    action: options.action,
    ...createMemberAuditContext({
      actorUserId: options.actorUserId,
      metadata: options.metadata ?? {},
      targetUserId: options.targetUserId,
      workspaceId: options.workspaceId,
    }),
  });
}
