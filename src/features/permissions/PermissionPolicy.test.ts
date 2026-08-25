import { describe, expect, it } from 'vitest';
import { getProjectPermissionDecision, getWorkspacePermissions } from './PermissionPolicy';

describe('permission policy', () => {
  it('maps team workspace roles to capabilities', () => {
    expect(getWorkspacePermissions('viewer', 'team')).toStrictEqual(['workspace.read']);
    expect(getWorkspacePermissions('editor', 'team')).toContain('project.create');
  });

  it('restricts personal resources to their owner', () => {
    expect(getWorkspacePermissions('owner', 'personal')).toStrictEqual([
      'workspace.read',
      'workspace.update',
      'project.create',
    ]);
    expect(getWorkspacePermissions('editor', 'personal')).toStrictEqual([]);
    const nonOwnerDecision = getProjectPermissionDecision({
      isProjectOwner: false,
      projectRole: null,
      workspaceRole: 'owner',
      workspaceKind: 'personal',
    });
    const ownerDecision = getProjectPermissionDecision({
      isProjectOwner: true,
      projectRole: 'owner',
      workspaceRole: 'owner',
      workspaceKind: 'personal',
    });

    expect(nonOwnerDecision.permissions).toStrictEqual([]);
    expect(ownerDecision.permissions).toStrictEqual([
      'project.structure.read',
      'project.read',
      'project.update',
      'project.delete',
      'document.read',
      'document.create',
      'document.update',
      'document.delete',
    ]);
  });

  it('limits non-project team members to structure', () => {
    for (const workspaceRole of ['editor', 'owner'] as const) {
      const decision = getProjectPermissionDecision({
        isProjectOwner: false,
        projectRole: null,
        workspaceRole,
        workspaceKind: 'team',
      });

      expect(decision.permissions).toStrictEqual(['project.structure.read']);
      expect(decision.isResourceOwner).toBeFalsy();
    }
  });

  it('uses direct project role for content permissions', () => {
    const decision = getProjectPermissionDecision({
      isProjectOwner: false,
      projectRole: 'viewer',
      workspaceRole: 'editor',
      workspaceKind: 'team',
    });

    expect(decision.grants).toStrictEqual([
      { role: 'editor', source: 'workspace' },
      { role: 'viewer', source: 'project' },
    ]);
    expect(decision.permissions).toContain('document.read');
    expect(decision.permissions).not.toContain('document.update');
  });
});
