/* oxlint-disable typescript/no-unsafe-argument -- Runtime validation guarantees folder paths are strings. */
const path = require('node:path');

const isStringArray = (value) =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');

/**
 * Parses and validates codegraph.watch.json.
 *
 * @param {unknown} value - Configuration value read from JSON.
 * @returns {{command: string, debounceMs: number, ignored: string[], watchFolders: string[]}} Validated configuration.
 */
const parseConfig = (value) => {
  if (typeof value !== 'object' || value === null) {
    throw new Error('Configuration must be an object');
  }

  const command = Reflect.get(value, 'command');
  const debounceMs = Reflect.get(value, 'debounceMs');
  const ignored = Reflect.get(value, 'ignored');
  const watchFolders = Reflect.get(value, 'watchFolders');
  if (typeof command !== 'string' || command.trim().length === 0) {
    throw new Error('"command" must be a non-empty string');
  }
  if (!isStringArray(watchFolders) || watchFolders.length === 0) {
    throw new Error('"watchFolders" must contain at least one folder');
  }
  if (!isStringArray(ignored)) {
    throw new Error('"ignored" must be an array of folder paths');
  }
  if (typeof debounceMs !== 'number' || !Number.isFinite(debounceMs) || debounceMs < 0) {
    throw new Error('"debounceMs" must be a non-negative number');
  }

  return { command, debounceMs, ignored, watchFolders };
};

/**
 * Returns whether a path is strictly inside a folder.
 *
 * @param {string} filePath - Absolute file path.
 * @param {string} folderPath - Absolute folder path.
 * @returns {boolean} Whether the file is inside the folder.
 */
const isInsideFolder = (filePath, folderPath) => {
  const relativePath = path.relative(folderPath, filePath);
  return (
    relativePath !== '' &&
    relativePath !== '..' &&
    !relativePath.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relativePath)
  );
};

/**
 * Returns whether a saved file is selected by the configuration.
 *
 * @param {{config: {ignored: string[], watchFolders: string[]}, filePath: string, root: string}} options - Configuration, saved file path, and workspace root.
 * @returns {boolean} Whether saving the file should run the command.
 */
const matchesSavedFile = (options) => {
  const watched = options.config.watchFolders.some((folder) =>
    isInsideFolder(options.filePath, path.resolve(options.root, folder)),
  );
  if (!watched) {
    return false;
  }

  return !options.config.ignored.some((folder) =>
    isInsideFolder(options.filePath, path.resolve(options.root, folder)),
  );
};

module.exports = { isInsideFolder, matchesSavedFile, parseConfig };
