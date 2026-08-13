import { describe, expect, it } from 'vitest';
import { canMutatePermissionGroupMembers } from './PermissionOverview';

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
