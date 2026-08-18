import { describe, expect, it } from 'vitest';
import { escapeRegularExpression } from './RegularExpression';

describe(escapeRegularExpression, () => {
  it('escapes every regular-expression metacharacter', () => {
    const input = ['.*+?^$', '{}()|[]\\'].join('');

    expect(new RegExp(escapeRegularExpression(input), 'u').test(input)).toBeTruthy();
  });
});
