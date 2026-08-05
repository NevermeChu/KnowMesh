import 'server-only';
import { auth } from '@clerk/nextjs/server';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { projectMembersSchema, projectsSchema } from '@/models/Schema';
import type { ProjectKind } from '../Project';

export async function getProjects(options: { kind?: ProjectKind } = {}) {
  const { userId } = await auth.protect();
  const memberCondition = eq(projectMembersSchema.userId, userId);
  const projectCondition = options.kind
    ? and(memberCondition, eq(projectsSchema.kind, options.kind))
    : memberCondition;

  return await db
    .select({
      createdAt: projectsSchema.createdAt,
      id: projectsSchema.id,
      kind: projectsSchema.kind,
      name: projectsSchema.name,
      role: projectMembersSchema.role,
      updatedAt: projectsSchema.updatedAt,
    })
    .from(projectsSchema)
    .innerJoin(projectMembersSchema, eq(projectMembersSchema.projectId, projectsSchema.id))
    .where(projectCondition)
    .orderBy(desc(projectsSchema.createdAt));
}
