import { spawn } from 'node:child_process';
import { statSync, watch } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

type CodeGraphWatchConfig = {
  command: string;
  debounceMs: number;
  ignored: string[];
  watchFolders: string[];
};

const CONFIG_PATH = 'codegraph.watch.json';

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');

/**
 * Parses and validates the CodeGraph watcher configuration.
 *
 * @param value - Configuration value read from JSON.
 * @returns Validated watcher configuration.
 * @throws When the configuration is invalid.
 */
export const parseCodeGraphWatchConfig = (value: unknown): CodeGraphWatchConfig => {
  if (typeof value !== 'object' || value === null) {
    throw new Error('CodeGraph watch configuration must be an object');
  }

  const command = Reflect.get(value, 'command');
  const debounceMs = Reflect.get(value, 'debounceMs');
  const ignored = Reflect.get(value, 'ignored');
  const watchFolders = Reflect.get(value, 'watchFolders');
  if (typeof command !== 'string' || command.length === 0) {
    throw new Error('"command" must be a non-empty string');
  }
  if (!isStringArray(watchFolders) || watchFolders.length === 0) {
    throw new Error('"watchFolders" must contain at least one folder');
  }
  if (!isStringArray(ignored)) {
    throw new Error('"ignored" must be an array of folder names or paths');
  }
  if (typeof debounceMs !== 'number' || !Number.isFinite(debounceMs) || debounceMs < 0) {
    throw new Error('"debounceMs" must be a non-negative number');
  }

  return {
    command,
    debounceMs,
    ignored,
    watchFolders,
  };
};

/**
 * Returns whether a changed path is inside an ignored path.
 *
 * @param options - Changed path, ignored paths, and repository root.
 * @returns Whether the changed path should be ignored.
 */
export const isIgnoredPath = (options: {
  changedPath: string;
  ignoredPaths: string[];
  root: string;
}) => {
  const absoluteChangedPath = resolve(options.root, options.changedPath);

  return options.ignoredPaths.some((ignoredPath) => {
    const absoluteIgnoredPath = resolve(options.root, ignoredPath);
    const relativePath = relative(absoluteIgnoredPath, absoluteChangedPath);
    return relativePath === '' || (!relativePath.startsWith(`..${sep}`) && relativePath !== '..');
  });
};

const runCommand = async (config: CodeGraphWatchConfig, root: string) => {
  const child = spawn(config.command, {
    cwd: root,
    shell: true,
    stdio: 'inherit',
    windowsHide: true,
  });
  const { promise, reject, resolve: resolveExit } = Promise.withResolvers<number>();
  child.once('error', reject);
  child.once('exit', (code) => {
    resolveExit(code ?? 1);
  });
  return await promise;
};

/**
 * Watches configured folders and serializes CodeGraph index runs.
 *
 * @param config - Validated watcher configuration.
 * @param root - Repository root used for relative paths and command execution.
 * @returns A function that closes all file watchers.
 */
export const watchCodeGraph = (config: CodeGraphWatchConfig, root: string) => {
  let debounceTimer: NodeJS.Timeout | undefined;
  let isRunning = false;
  let rerunRequested = false;

  const execute = async () => {
    if (isRunning) {
      rerunRequested = true;
      return;
    }

    isRunning = true;
    console.log(`[codegraph-watch] Running: ${config.command}`);
    try {
      const exitCode = await runCommand(config, root);
      if (exitCode !== 0) {
        console.error(`[codegraph-watch] Command exited with code ${exitCode}`);
      }
    } catch (error) {
      console.error('[codegraph-watch] Failed to start command', error);
    } finally {
      isRunning = false;
      if (rerunRequested) {
        rerunRequested = false;
        await execute();
      }
    }
  };

  const schedule = async (changedPath: string) => {
    if (isIgnoredPath({ changedPath, ignoredPaths: config.ignored, root })) {
      return;
    }

    try {
      const changedEntry = await stat(changedPath);
      if (!changedEntry.isFile()) {
        return;
      }
    } catch {
      // Editors can briefly remove a file while performing an atomic save.
      return;
    }

    console.log(`[codegraph-watch] File saved: ${changedPath}`);
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => void execute(), config.debounceMs);
  };

  const watchers = config.watchFolders.map((folder) => {
    const absoluteFolder = isAbsolute(folder) ? folder : resolve(root, folder);
    if (!statSync(absoluteFolder).isDirectory()) {
      throw new Error(`Configured watch path is not a folder: ${absoluteFolder}`);
    }
    console.log(`[codegraph-watch] Watching: ${absoluteFolder}`);
    return watch(absoluteFolder, { recursive: true }, (_event, filename) => {
      if (filename) {
        void schedule(resolve(absoluteFolder, filename));
      }
    });
  });

  return () => {
    clearTimeout(debounceTimer);
    for (const watcher of watchers) {
      watcher.close();
    }
  };
};

const main = async () => {
  const root = process.cwd();
  const configFile = process.argv[2] ?? CONFIG_PATH;
  const configValue: unknown = JSON.parse(await readFile(resolve(root, configFile), 'utf-8'));
  const config = parseCodeGraphWatchConfig(configValue);
  const close = watchCodeGraph(config, root);

  process.once('SIGINT', close);
  process.once('SIGTERM', close);
};

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  await main();
}
