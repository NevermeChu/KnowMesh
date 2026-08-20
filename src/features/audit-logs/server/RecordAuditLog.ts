import 'server-only';
import { headers } from 'next/headers';
import { auditLogsSchema } from '@/models/Schema';
import type { AuditAction, AuditLogMetadata, AuditTargetKind } from '../AuditLog';

export type AuditDatabase = {
  insert: (table: typeof auditLogsSchema) => {
    values: (values: typeof auditLogsSchema.$inferInsert) => Promise<unknown>;
  };
};

export type RecordAuditLogOptions = {
  action: AuditAction;
  actorUserId: string;
  ipAddress?: string | null;
  metadata?: AuditLogMetadata;
  targetId?: string | null;
  targetKind?: AuditTargetKind | null;
  userAgent?: string | null;
  workspaceId: string;
};

/**
 * Inserts an audit log record within the provided database/transaction context.
 *
 * @param database - Database client or active transaction.
 * @param options - Audit action details, actor, target and metadata.
 */
export async function recordAuditLog(database: AuditDatabase, options: RecordAuditLogOptions) {
  let ipAddress = options.ipAddress ?? null;
  let userAgent = options.userAgent ?? null;

  try {
    const requestHeaders = await headers();
    ipAddress ??=
      requestHeaders.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      requestHeaders.get('x-real-ip') ??
      null;
    userAgent ??= requestHeaders.get('user-agent') ?? null;
  } catch {
    // In non-request context (e.g. tests or background hooks) headers() throws
  }

  await database.insert(auditLogsSchema).values({
    action: options.action,
    actorUserId: options.actorUserId,
    ipAddress,
    metadata: options.metadata ?? {},
    targetId: options.targetId ?? null,
    targetKind: options.targetKind ?? null,
    userAgent,
    workspaceId: options.workspaceId,
  });
}
