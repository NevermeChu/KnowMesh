import * as z from 'zod';
import { memberRoles } from './Permission';

const assignableRoleSchema = z.enum(memberRoles).exclude(['owner']);

export const inviteWorkspaceMemberSchema = z.object({
  email: z.email('请输入有效邮箱').trim().toLowerCase(),
  workspaceId: z.uuid(),
});

export const acceptWorkspaceInvitationSchema = z.object({ token: z.string().min(32).max(256) });

export const workspaceMemberMutationSchema = z.object({
  memberUserId: z.string().min(1),
  role: assignableRoleSchema.optional(),
  workspaceId: z.uuid(),
});

export const projectMemberMutationSchema = z.object({
  memberUserId: z.string().min(1),
  projectId: z.uuid(),
  role: assignableRoleSchema.optional(),
});

export const projectInvitationSchema = z.object({
  memberUserId: z.string().min(1),
  projectId: z.uuid(),
});

export const projectAccessRequestSchema = z.object({
  projectId: z.uuid(),
  requestedRole: assignableRoleSchema,
});

export const projectAccessReviewSchema = z.object({
  memberUserId: z.string().min(1),
  projectId: z.uuid(),
});

export const workspaceAccessRequestSchema = z.object({ workspaceId: z.uuid() });

export const workspaceAccessReviewSchema = z.object({
  memberUserId: z.string().min(1),
  workspaceId: z.uuid(),
});

export const revokeWorkspaceInvitationSchema = z.object({
  invitationId: z.uuid(),
  workspaceId: z.uuid(),
});

export type AcceptWorkspaceInvitationInput = z.infer<typeof acceptWorkspaceInvitationSchema>;
export type InviteWorkspaceMemberInput = z.infer<typeof inviteWorkspaceMemberSchema>;
export type ProjectMemberMutationInput = z.infer<typeof projectMemberMutationSchema>;
export type ProjectInvitationInput = z.infer<typeof projectInvitationSchema>;
export type ProjectAccessRequestInput = z.infer<typeof projectAccessRequestSchema>;
export type ProjectAccessReviewInput = z.infer<typeof projectAccessReviewSchema>;
export type RevokeWorkspaceInvitationInput = z.infer<typeof revokeWorkspaceInvitationSchema>;
export type WorkspaceMemberMutationInput = z.infer<typeof workspaceMemberMutationSchema>;
export type WorkspaceAccessRequestInput = z.infer<typeof workspaceAccessRequestSchema>;
export type WorkspaceAccessReviewInput = z.infer<typeof workspaceAccessReviewSchema>;
