import { describe, expect, it } from 'vitest';
import { isIgnoredPath, parseCodeGraphWatchConfig } from './codegraph-watch';

describe(parseCodeGraphWatchConfig, () => {
  it('parses valid configuration', () => {
    const config = {
      command: 'codegraph index .',
      debounceMs: 500,
      ignored: ['.codegraph'],
      watchFolders: ['src'],
    };

    expect(parseCodeGraphWatchConfig(config)).toStrictEqual(config);
  });

  it('rejects empty watch folders', () => {
    expect(() =>
      parseCodeGraphWatchConfig({
        command: 'codegraph index .',
        debounceMs: 500,
        ignored: [],
        watchFolders: [],
      }),
    ).toThrow('"watchFolders" must contain at least one folder');
  });
});

describe(isIgnoredPath, () => {
  it('distinguishes ignored and watched paths', () => {
    for (const testCase of [
      { changedPath: '.codegraph/codegraph.db', expected: true },
      { changedPath: 'src/page.tsx', expected: false },
    ]) {
      expect(
        isIgnoredPath({
          changedPath: testCase.changedPath,
          ignoredPaths: ['.codegraph'],
          root: 'C:\\project',
        }),
      ).toBe(testCase.expected);
    }
  });
});
