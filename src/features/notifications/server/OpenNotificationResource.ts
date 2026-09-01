'use server';

import { and, eq } from 'drizzle-orm';
import { requireUser } from '@/features/auth/server/CurrentUser';
import type { OpenNotificationResourceInput } from '@/features/notifications/NotificationSchema';
import { openNotificationResourceSchema } from '@/features/notifications/NotificationSchema';
import { runMemberAction } from '@/features/permissions/MemberWorkflow';
import { selectWorkspace } from '@/features/workspaces/server/SelectWorkspace';
import { db } from '@/libs/DB';
import { projectsSchema, workspaceMembersSchema, workspacesSchema } from '@/models/Schema';

export type OpenNotificationResourceResult =
  | { href: string; ok: true }
  | { error: string; ok: false };

/**
 * Activates the target workspace and returns the in-app href for a notification resource.
 *
 * @param input - Notification target kind and identifier.
 * @returns A workspace or project href, or a client-safe error.
 */
export async function openNotificationResource(
  input: OpenNotificationResourceInput,
): Promise<OpenNotificationResourceResult> {
  const parsed = openNotificationResourceSchema.safeParse(input);
  if (!parsed.success) {
    return { error: '通知目标无效', ok: false };
  }

  const { id: userId } = await requireUser();

  if (parsed.data.targetKind === 'workspace') {
    const selected = await runMemberAction(async () => {
      await selectWorkspace({ workspaceId: parsed.data.targetId });
    });
    if (!selected.ok) {
      return selected;
    }

    return { href: '/dashboard', ok: true };
  }

  const [project] = await db
    .select({
      kind: workspacesSchema.kind,
      workspaceId: projectsSchema.workspaceId,
    })
    .from(projectsSchema)
    .innerJoin(workspacesSchema, eq(workspacesSchema.id, projectsSchema.workspaceId))
    .innerJoin(
      workspaceMembersSchema,
      and(
        eq(workspaceMembersSchema.workspaceId, projectsSchema.workspaceId),
        eq(workspaceMembersSchema.userId, userId),
      ),
    )
    .where(eq(projectsSchema.id, parsed.data.targetId))
    .limit(1);

  if (!project) {
    return { error: '项目不存在或无权访问', ok: false };
  }

  const selected = await runMemberAction(async () => {
    await selectWorkspace({ workspaceId: project.workspaceId });
  });
  if (!selected.ok) {
    return selected;
  }

  const area = project.kind === 'personal' ? 'personal' : 'collaboration';
  return { href: `/${area}?project=${parsed.data.targetId}`, ok: true };
}
