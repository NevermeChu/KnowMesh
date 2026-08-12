import * as z from 'zod';
import { memberRoles } from './Permission';

const assignableRoleSchema = z.enum(memberRoles).exclude(['owner']);

export const inviteWorkspaceMemberSchema = z.object({
  email: z.email('请输入有效邮箱').trim().toLowerCase(),
  role: assignableRoleSchema,
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

export type AcceptWorkspaceInvitationInput = z.infer<typeof acceptWorkspaceInvitationSchema>;
export type InviteWorkspaceMemberInput = z.infer<typeof inviteWorkspaceMemberSchema>;
export type ProjectMemberMutationInput = z.infer<typeof projectMemberMutationSchema>;
export type WorkspaceMemberMutationInput = z.infer<typeof workspaceMemberMutationSchema>;
