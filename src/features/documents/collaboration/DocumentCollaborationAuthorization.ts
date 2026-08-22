import { and, eq, gt } from 'drizzle-orm';
import { getProjectPermissionDecision } from '@/features/permissions/PermissionPolicy';
import { db } from '@/libs/DB';
import {
  documentsSchema,
  projectMembersSchema,
  projectsSchema,
  sessionSchema,
  userSchema,
  workspaceMembersSchema,
  workspacesSchema,
} from '@/models/Schema';

export async function getDocumentCollaborationAccess(options: {
  documentId: string;
  userId: string;
}) {
  const [access] = await db
    .select({
      projectId: projectsSchema.id,
      projectOwnerId: projectsSchema.ownerId,
      projectRole: projectMembersSchema.role,
      workspaceKind: workspacesSchema.kind,
      workspaceRole: workspaceMembersSchema.role,
    })
    .from(documentsSchema)
    .innerJoin(projectsSchema, eq(projectsSchema.id, documentsSchema.projectId))
    .innerJoin(workspacesSchema, eq(workspacesSchema.id, projectsSchema.workspaceId))
    .innerJoin(
      workspaceMembersSchema,
      and(
        eq(workspaceMembersSchema.workspaceId, projectsSchema.workspaceId),
        eq(workspaceMembersSchema.userId, options.userId),
      ),
    )
    .leftJoin(
      projectMembersSchema,
      and(
        eq(projectMembersSchema.projectId, projectsSchema.id),
        eq(projectMembersSchema.userId, options.userId),
      ),
    )
    .where(eq(documentsSchema.id, options.documentId))
    .limit(1);

  if (!access || access.workspaceKind !== 'team') {
    return null;
  }

  const decision = getProjectPermissionDecision({
    isProjectOwner: access.projectOwnerId === options.userId,
    projectRole: access.projectRole,
    workspaceKind: access.workspaceKind,
    workspaceRole: access.workspaceRole,
  });

  if (!decision.permissions.includes('document.read')) {
    return null;
  }

  return {
    canWrite: decision.permissions.includes('document.update'),
    projectId: access.projectId,
  };
}

export async function isDocumentCollaborationSessionActive(options: {
  sessionId: string;
  userId: string;
}) {
  const [session] = await db
    .select({ id: sessionSchema.id })
    .from(sessionSchema)
    .innerJoin(userSchema, eq(userSchema.id, sessionSchema.userId))
    .where(
      and(
        eq(sessionSchema.id, options.sessionId),
        eq(sessionSchema.userId, options.userId),
        gt(sessionSchema.expiresAt, new Date()),
        eq(userSchema.emailVerified, true),
      ),
    )
    .limit(1);

  return session !== undefined;
}
