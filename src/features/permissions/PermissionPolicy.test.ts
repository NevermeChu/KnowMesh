import { describe, expect, it } from 'vitest';
import { getProjectPermissionDecision, getWorkspacePermissions } from './PermissionPolicy';

describe('permission policy', () => {
  it('limits workspace viewer to reading', () => {
    expect(getWorkspacePermissions('viewer')).toStrictEqual(['workspace.read']);
  });

  it('grants workspace editor project creation', () => {
    expect(getWorkspacePermissions('editor')).toContain('project.create');
  });

  it('keeps personal project private from workspace owner', () => {
    const decision = getProjectPermissionDecision({
      isProjectOwner: false,
      kind: 'personal',
      projectRole: null,
      workspaceRole: 'owner',
    });

    expect(decision.permissions).toStrictEqual([]);
  });

  it('inherits collaboration editing from workspace editor', () => {
    const decision = getProjectPermissionDecision({
      isProjectOwner: false,
      kind: 'collaboration',
      projectRole: null,
      workspaceRole: 'editor',
    });

    expect(decision.permissions).toContain('document.update');
    expect(decision.permissions).not.toContain('project.delete');
  });

  it('grants collaboration deletion to workspace owner without project ownership', () => {
    const decision = getProjectPermissionDecision({
      isProjectOwner: false,
      kind: 'collaboration',
      projectRole: null,
      workspaceRole: 'owner',
    });

    expect(decision.permissions).toContain('project.delete');
    expect(decision.isResourceOwner).toBeFalsy();
  });

  it('combines direct and inherited grants', () => {
    const decision = getProjectPermissionDecision({
      isProjectOwner: false,
      kind: 'collaboration',
      projectRole: 'viewer',
      workspaceRole: 'editor',
    });

    expect(decision.grants).toStrictEqual([
      { role: 'viewer', source: 'project' },
      { role: 'editor', source: 'workspace' },
    ]);
    expect(decision.permissions).toContain('document.update');
  });
});
