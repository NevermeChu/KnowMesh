import { describe, expect, it } from 'vitest';
import { getProjectPermissionDecision, getWorkspacePermissions } from './PermissionPolicy';

describe('permission policy', () => {
  it('limits workspace viewer to reading', () => {
    expect(getWorkspacePermissions('viewer', 'team')).toStrictEqual(['workspace.read']);
  });

  it('grants workspace editor project creation', () => {
    expect(getWorkspacePermissions('editor', 'team')).toContain('project.create');
  });

  it('prevents personal workspace membership capabilities', () => {
    expect(getWorkspacePermissions('owner', 'personal')).toStrictEqual([
      'workspace.read',
      'workspace.update',
      'project.create',
    ]);
    expect(getWorkspacePermissions('editor', 'personal')).toStrictEqual([]);
  });

  it('keeps personal project private from workspace owner', () => {
    const decision = getProjectPermissionDecision({
      isProjectOwner: false,
      projectRole: null,
      workspaceRole: 'owner',
      workspaceKind: 'personal',
    });

    expect(decision.permissions).toStrictEqual([]);
  });

  it('excludes member management from personal project owner', () => {
    const decision = getProjectPermissionDecision({
      isProjectOwner: true,
      projectRole: 'owner',
      workspaceRole: 'owner',
      workspaceKind: 'personal',
    });

    expect(decision.permissions).toContain('project.delete');
    expect(decision.permissions).not.toContain('project.members.manage');
  });

  it('inherits collaboration editing from workspace editor', () => {
    const decision = getProjectPermissionDecision({
      isProjectOwner: false,
      projectRole: null,
      workspaceRole: 'editor',
      workspaceKind: 'team',
    });

    expect(decision.permissions).toContain('document.update');
    expect(decision.permissions).not.toContain('project.delete');
  });

  it('grants collaboration deletion to workspace owner without project ownership', () => {
    const decision = getProjectPermissionDecision({
      isProjectOwner: false,
      projectRole: null,
      workspaceRole: 'owner',
      workspaceKind: 'team',
    });

    expect(decision.permissions).toContain('project.delete');
    expect(decision.isResourceOwner).toBeFalsy();
  });

  it('combines direct and inherited grants', () => {
    const decision = getProjectPermissionDecision({
      isProjectOwner: false,
      projectRole: 'viewer',
      workspaceRole: 'editor',
      workspaceKind: 'team',
    });

    expect(decision.grants).toStrictEqual([
      { role: 'viewer', source: 'project' },
      { role: 'editor', source: 'workspace' },
    ]);
    expect(decision.permissions).toContain('document.update');
  });
});
