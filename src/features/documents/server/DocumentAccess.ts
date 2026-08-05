import 'server-only';
import { and, eq } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { documentsSchema, projectMembersSchema, projectsSchema } from '@/models/Schema';

export async function getProjectAccess(options: { projectId: string; userId: string }) {
  const [access] = await db
    .select({
      id: projectsSchema.id,
      kind: projectsSchema.kind,
      name: projectsSchema.name,
      role: projectMembersSchema.role,
    })
    .from(projectsSchema)
    .innerJoin(projectMembersSchema, eq(projectMembersSchema.projectId, projectsSchema.id))
    .where(
      and(
        eq(projectsSchema.id, options.projectId),
        eq(projectMembersSchema.userId, options.userId),
      ),
    )
    .limit(1);

  return access;
}

export async function getDocumentAccess(options: { documentId: string; userId: string }) {
  const [access] = await db
    .select({
      projectId: documentsSchema.projectId,
      role: projectMembersSchema.role,
    })
    .from(documentsSchema)
    .innerJoin(projectMembersSchema, eq(projectMembersSchema.projectId, documentsSchema.projectId))
    .where(
      and(
        eq(documentsSchema.id, options.documentId),
        eq(projectMembersSchema.userId, options.userId),
      ),
    )
    .limit(1);

  return access;
}
