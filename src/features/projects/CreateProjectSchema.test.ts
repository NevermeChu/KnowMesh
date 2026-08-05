import { describe, expect, it } from 'vitest';
import { createProjectSchema } from './CreateProjectSchema';

describe('project creation input', () => {
  it('parses valid project input', () => {
    expect(createProjectSchema.parse({ kind: 'personal', name: '  产品知识库  ' })).toStrictEqual({
      kind: 'personal',
      name: '产品知识库',
    });
  });

  it('rejects empty project names', () => {
    expect(createProjectSchema.safeParse({ kind: 'personal', name: '   ' }).success).toBeFalsy();
  });

  it('rejects unknown project kinds', () => {
    expect(createProjectSchema.safeParse({ kind: 'team', name: '产品知识库' }).success).toBeFalsy();
  });
});
