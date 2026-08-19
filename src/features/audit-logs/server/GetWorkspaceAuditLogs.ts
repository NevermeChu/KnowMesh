import 'server-only';
import { and, desc, eq, inArray } from 'drizzle-orm';
import * as z from 'zod';
import { requireUser } from '@/features/auth/server/CurrentUser';
import { AuthorizationError } from '@/features/permissions/AuthorizationError';
import { authorizeWorkspace } from '@/features/permissions/server/WorkspaceAuthorization';
import { getUserProfiles } from '@/features/users/server/GetUserProfiles';
import { db } from '@/libs/DB';
import { auditLogsSchema } from '@/models/Schema';
import type { AuditAction, AuditLogItem } from '../AuditLog';
import { auditActionCategories, auditActions } from '../AuditLog';

const getAuditLogsInputSchema = z.object({
  category: z.enum(['all', 'membership', 'permissions', 'resources']).optional(),
  limit: z.number().int().min(1).max(100).optional(),
  offset: z.number().int().min(0).optional(),
  workspaceId: z.uuid(),
});

export type GetAuditLogsInput = z.input<typeof getAuditLogsInputSchema>;

/**
 * Returns authorized audit log entries for a team workspace.
 *
 * @param input - Workspace ID, category filter, limit, and offset.
 * @returns Array of structured audit log items visible exclusively to workspace owner.
 * @throws AuthorizationError when caller is not the workspace owner or workspace is personal.
 */
export async function getWorkspaceAuditLogs(input: GetAuditLogsInput): Promise<AuditLogItem[]> {
  const { id: userId } = await requireUser();
  const parsedInput = getAuditLogsInputSchema.parse(input);

  const authorization = await authorizeWorkspace({
    permission: 'workspace.delete',
    userId,
    workspaceId: parsedInput.workspaceId,
  });

  if (authorization.workspace.kind === 'personal' || authorization.workspace.ownerId !== userId) {
    throw new AuthorizationError('只有工作区所有者可以查看审计日志');
  }

  const category = parsedInput.category ?? 'all';
  const categoryActions: AuditAction[] | null =
    category === 'all'
      ? null
      : auditActions.filter((action) => auditActionCategories[action] === category);

  const whereConditions = [eq(auditLogsSchema.workspaceId, parsedInput.workspaceId)];
  if (categoryActions && categoryActions.length > 0) {
    whereConditions.push(inArray(auditLogsSchema.action, categoryActions));
  }

  const logs = await db
    .select()
    .from(auditLogsSchema)
    .where(and(...whereConditions))
    .orderBy(desc(auditLogsSchema.createdAt))
    .limit(parsedInput.limit ?? 50)
    .offset(parsedInput.offset ?? 0);

  if (logs.length === 0) {
    return [];
  }

  const userIdsToFetch = new Set<string>();
  for (const log of logs) {
    userIdsToFetch.add(log.actorUserId);
    if (log.metadata.targetUserId) {
      userIdsToFetch.add(log.metadata.targetUserId);
    }
  }

  const profiles = await getUserProfiles([...userIdsToFetch]);

  return logs.map((log): AuditLogItem => {
    const actorProfile = profiles.get(log.actorUserId);
    const targetProfile = log.metadata.targetUserId
      ? profiles.get(log.metadata.targetUserId)
      : null;

    return {
      action: log.action,
      actor: {
        displayName: actorProfile?.displayName ?? log.actorUserId,
        email: actorProfile?.email ?? null,
        imageUrl: actorProfile?.imageUrl ?? null,
        userId: log.actorUserId,
      },
      createdAt: log.createdAt,
      id: log.id,
      ipAddress: log.ipAddress,
      metadata: {
        ...log.metadata,
        targetUserEmail: targetProfile?.email ?? log.metadata.targetUserEmail ?? null,
        targetUserName: targetProfile?.displayName ?? log.metadata.targetUserName,
      },
      targetId: log.targetId,
      targetKind: log.targetKind,
      userAgent: log.userAgent,
      workspaceId: log.workspaceId,
    };
  });
}
