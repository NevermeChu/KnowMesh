'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { recordAuditLog } from '@/features/audit-logs/server/RecordAuditLog';
import { requireUser } from '@/features/auth/server/CurrentUser';
import { authorizeProject } from '@/features/permissions/server/ProjectAuthorization';
import { db } from '@/libs/DB';
import { projectsSchema } from '@/models/Schema';
import { updateProjectSchema } from '../ProjectMutationSchema';
import type { UpdateProjectInput } from '../ProjectMutationSchema';

export async function updateProject(input: UpdateProjectInput) {
  const { id: userId } = await requireUser();
  const projectInput = updateProjectSchema.parse(input);
  const authorization = await authorizeProject({
    permission: 'project.update',
    projectId: projectInput.projectId,
    userId,
  });
  const [project] = await db
    .update(projectsSchema)
    .set({ name: projectInput.name, updatedAt: new Date() })
    .where(eq(projectsSchema.id, authorization.project.id))
    .returning({ id: projectsSchema.id });

  if (!project) {
    throw new Error('项目保存失败');
  }

  if (authorization.project.workspaceKind === 'team') {
    await recordAuditLog(db, {
      action: 'project_renamed',
      actorUserId: userId,
      metadata: {
        nextName: projectInput.name,
        previousName: authorization.project.name,
        resourceName: projectInput.name,
      },
      targetId: authorization.project.id,
      targetKind: 'project',
      workspaceId: authorization.project.workspaceId,
    });
  }

  revalidatePath('/(workspace)', 'layout');
}
