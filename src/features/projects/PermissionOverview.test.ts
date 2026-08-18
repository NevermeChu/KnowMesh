import { describe, expect, it } from 'vitest';
import {
  canMutatePermissionGroupMembers,
  getPermissionOverviewRemovalMode,
} from './PermissionOverview';

describe(canMutatePermissionGroupMembers, () => {
  it('allows actions only on the direct member group', () => {
    const cases = [
      { expected: true, scope: 'project', source: 'project' },
      { expected: false, scope: 'project', source: 'workspace' },
      { expected: true, scope: 'workspace', source: 'workspace' },
      { expected: false, scope: 'document', source: 'project' },
    ] as const;

    for (const testCase of cases) {
      expect(
        canMutatePermissionGroupMembers({
          scope: testCase.scope,
          source: testCase.source,
        }),
      ).toBe(testCase.expected);
    }
  });
});

describe(getPermissionOverviewRemovalMode, () => {
  const baseGroup = { id: 'resource_1', members: [], name: '资源', source: 'project' as const };

  it('maps owners to deletion and members to exit', () => {
    expect(
      getPermissionOverviewRemovalMode({
        currentUserRole: 'owner',
        groups: [baseGroup],
        permissions: [],
        project: { id: 'project_1', name: '项目' },
        requests: [],
        scope: 'project',
        workspaceMembers: [],
      }),
    ).toBe('delete');
    expect(
      getPermissionOverviewRemovalMode({
        currentUserRole: 'viewer',
        description: '团队工作区',
        groups: [{ ...baseGroup, source: 'workspace' }],
        invitations: [],
        permissions: [],
        requests: [],
        scope: 'workspace',
        title: '工作区权限',
        workspaceId: 'workspace_1',
      }),
    ).toBe('leave');
  });

  it('hides exit for workspace-only project viewers', () => {
    expect(
      getPermissionOverviewRemovalMode({
        currentUserRole: null,
        groups: [baseGroup],
        permissions: ['project.structure.read'],
        project: { id: 'project_1', name: '项目' },
        requests: [],
        scope: 'project',
        workspaceMembers: [],
      }),
    ).toBeNull();
  });

  it('allows direct project viewers to leave from member groups', () => {
    expect(
      getPermissionOverviewRemovalMode({
        currentUserRole: null,
        groups: [
          {
            id: 'project_1',
            members: [
              {
                displayName: 'Viewer',
                email: null,
                imageUrl: null,
                isCurrentUser: true,
                role: 'viewer',
                userId: 'user_1',
              },
            ],
            name: 'Project',
            source: 'project',
          },
        ],
        permissions: ['project.read'],
        project: { id: 'project_1', name: 'Project' },
        requests: [],
        scope: 'project',
        workspaceMembers: [],
      }),
    ).toBe('leave');
  });
});
