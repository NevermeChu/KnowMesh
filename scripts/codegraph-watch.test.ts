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
  it('ignores changes inside configured folders', () => {
    expect(
      isIgnoredPath({
        changedPath: '.codegraph/codegraph.db',
        ignoredPaths: ['.codegraph'],
        root: 'C:\\project',
      }),
    ).toBeTruthy();
  });

  it('keeps changes outside configured folders', () => {
    expect(
      isIgnoredPath({
        changedPath: 'src/page.tsx',
        ignoredPaths: ['.codegraph'],
        root: 'C:\\project',
      }),
    ).toBeFalsy();
  });
});
