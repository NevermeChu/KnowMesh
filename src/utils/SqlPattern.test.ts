import { describe, expect, it } from 'vitest';
import { escapeSqlLikePattern } from './SqlPattern';

describe(escapeSqlLikePattern, () => {
  it('escapes SQL LIKE wildcard characters', () => {
    expect(escapeSqlLikePattern('100%_done\\test')).toBe('100\\%\\_done\\\\test');
  });
});
