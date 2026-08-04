import type { ChildProcess, SpawnOptions } from 'node:child_process';
import { spawn } from 'node:child_process';
import { connect } from 'node:net';
import { dirname, resolve } from 'node:path';
import process from 'node:process';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';

export type RuntimeMode = 'build-local' | 'dev' | 'playwright-dev' | 'playwright-start';

type Command = {
  args: string[];
  command: string;
  name: string;
};

type ProcessResult = {
  code: number;
  signal: NodeJS.Signals | null;
};

export type RuntimeOperations = {
  spawnProcess: (command: Command) => ChildProcess;
  terminateProcess: (child: ChildProcess) => Promise<void>;
  waitForPort: (child: ChildProcess) => Promise<void>;
};

type RuntimeSignal = {
  exitCode: number;
  signal: NodeJS.Signals;
};

const DATABASE_HOST = '127.0.0.1';
const DATABASE_PORT = 5432;
const STARTUP_TIMEOUT_MS = 60_000;
const SHUTDOWN_TIMEOUT_MS = 2000;

export const createCommands = (options: {
  cwd: string;
  mode: RuntimeMode;
  nodePath: string;
  npmCliPath: string;
}) => {
  const npmCommand = (name: string, script: string): Command => ({
    args: [options.npmCliPath, 'run', script],
    command: options.nodePath,
    name,
  });
  const databasePackage = fileURLToPath(import.meta.resolve('@electric-sql/pglite-socket'));
  const databaseArgs = [resolve(dirname(databasePackage), 'scripts/server.js'), '-m', '100'];

  if (options.mode === 'dev') {
    databaseArgs.push('--db=local.db');
  }

  const applicationScript = options.mode === 'playwright-start' ? 'start' : 'dev:next';

  return {
    application: npmCommand('Next.js', applicationScript),
    build: npmCommand('Next.js build', 'build:next'),
    database: {
      args: databaseArgs,
      command: options.nodePath,
      name: 'PGlite',
    },
    migration: npmCommand('Database migration', 'db:migrate'),
  };
};

const isRuntimeSignal = (value: unknown): value is RuntimeSignal =>
  typeof value === 'object' && value !== null && 'exitCode' in value;

const waitForExit = async (child: ChildProcess) => {
  const { promise, reject, resolve: resolveExit } = Promise.withResolvers<ProcessResult>();
  child.once('error', reject);
  child.once('exit', (code, signal) => {
    resolveExit({ code: code ?? (signal ? 1 : 0), signal });
  });
  return await promise;
};

const waitForChildOrTimeout = async (child: ChildProcess, timeoutMs: number) => {
  if (child.exitCode !== null || child.signalCode !== null) {
    return;
  }

  await Promise.race([waitForExit(child), delay(timeoutMs)]);
};

const assertSuccessful = (command: Command, result: ProcessResult) => {
  if (result.code !== 0) {
    throw new Error(`${command.name} exited with code ${result.code}`);
  }
};

export const runRuntime = async (options: {
  mode: RuntimeMode;
  operations: RuntimeOperations;
  signal?: Promise<RuntimeSignal>;
}) => {
  const commands = createCommands({
    cwd: process.cwd(),
    mode: options.mode,
    nodePath: process.execPath,
    npmCliPath: process.env.npm_execpath ?? '',
  });
  const children = new Set<ChildProcess>();
  let cleanupPromise: Promise<void> | undefined;

  const start = (command: Command) => {
    const child = options.operations.spawnProcess(command);
    const exit = waitForExit(child);
    children.add(child);
    child.once('exit', () => children.delete(child));
    return { child, exit };
  };
  const cleanup = async () => {
    cleanupPromise ??= (async () => {
      await Promise.all(
        [...children].map(async (child) => {
          await options.operations.terminateProcess(child);
        }),
      );
    })();
    await cleanupPromise;
  };

  const signal = options.signal ?? Promise.withResolvers<RuntimeSignal>().promise;
  const waitOrSignal = async <T>(operation: Promise<T>) => {
    const result = await Promise.race([
      operation.then((value) => ({ type: 'result' as const, value })),
      signal.then((value) => ({ type: 'signal' as const, value })),
    ]);

    if (result.type === 'signal') {
      await cleanup();
      return result.value;
    }

    return result.value;
  };

  try {
    const database = start(commands.database);
    const readiness = await waitOrSignal(options.operations.waitForPort(database.child));
    if (isRuntimeSignal(readiness)) {
      return readiness.exitCode;
    }
    const migration = start(commands.migration);
    const migrationResult = await waitOrSignal(migration.exit);
    if (isRuntimeSignal(migrationResult)) {
      return migrationResult.exitCode;
    }
    assertSuccessful(commands.migration, migrationResult);

    if (options.mode === 'build-local') {
      const build = start(commands.build);
      const result = await waitOrSignal(build.exit);
      if (isRuntimeSignal(result)) {
        return result.exitCode;
      }
      await cleanup();
      return result.code;
    }

    const application = start(commands.application);
    const result = await waitOrSignal(Promise.race([database.exit, application.exit]));
    if (isRuntimeSignal(result)) {
      return result.exitCode;
    }
    await cleanup();
    return result.code || 1;
  } catch (error) {
    await cleanup();
    throw error;
  }
};

const isMissingProcess = (error: unknown) =>
  error instanceof Error && 'code' in error && error.code === 'ESRCH';

export const createSystemOperations = (options: {
  cwd: string;
  platform: NodeJS.Platform;
}): RuntimeOperations => {
  const spawnProcess = (command: Command) => {
    const spawnOptions: SpawnOptions = {
      cwd: options.cwd,
      detached: options.platform !== 'win32',
      env: process.env,
      shell: false,
      stdio: 'inherit',
    };
    return spawn(command.command, command.args, spawnOptions);
  };

  const terminateProcess = async (child: ChildProcess) => {
    if (!child.pid || child.exitCode !== null || child.signalCode !== null) {
      return;
    }

    if (options.platform === 'win32') {
      const terminate = async (force: boolean) => {
        const { promise, resolve: resolveTermination } = Promise.withResolvers<null>();
        const args = ['/PID', String(child.pid), '/T'];
        if (force) {
          args.push('/F');
        }
        const taskkill = spawn('taskkill', args, { stdio: 'ignore', windowsHide: true });
        taskkill.once('error', () => {
          resolveTermination(null);
        });
        taskkill.once('exit', () => {
          resolveTermination(null);
        });
        await promise;
      };

      await terminate(false);
      await waitForChildOrTimeout(child, SHUTDOWN_TIMEOUT_MS);
      if (child.exitCode === null && child.signalCode === null) {
        await terminate(true);
      }
      return;
    }

    try {
      process.kill(-child.pid, 'SIGTERM');
    } catch (error) {
      if (!isMissingProcess(error)) {
        throw error;
      }
    }
    await waitForChildOrTimeout(child, SHUTDOWN_TIMEOUT_MS);
    if (child.exitCode === null && child.signalCode === null) {
      try {
        process.kill(-child.pid, 'SIGKILL');
      } catch (error) {
        if (!isMissingProcess(error)) {
          throw error;
        }
      }
    }
  };

  const waitForPort = async (child: ChildProcess) => {
    const { promise, reject, resolve: resolvePort } = Promise.withResolvers<null>();
    const startedAt = Date.now();
    const listeners: {
      onError?: (error: Error) => void;
      onExit?: (code: number | null) => void;
    } = {};
    let settled = false;

    const finish = (error?: Error) => {
      if (settled) {
        return;
      }
      settled = true;
      if (listeners.onError) {
        child.off('error', listeners.onError);
      }
      if (listeners.onExit) {
        child.off('exit', listeners.onExit);
      }
      if (error) {
        reject(error);
      } else {
        resolvePort(null);
      }
    };
    listeners.onError = (error) => {
      finish(error);
    };
    listeners.onExit = (code) => {
      finish(new Error(`PGlite exited before becoming ready with code ${code ?? 1}`));
    };
    const attempt = () => {
      const socket = connect({ host: DATABASE_HOST, port: DATABASE_PORT });
      socket.setTimeout(1000);
      socket.once('connect', () => {
        socket.destroy();
        finish();
      });
      const retry = () => {
        socket.destroy();
        if (settled) {
          return;
        }
        if (Date.now() - startedAt >= STARTUP_TIMEOUT_MS) {
          finish(new Error(`PGlite did not become ready within ${STARTUP_TIMEOUT_MS}ms`));
          return;
        }
        setTimeout(attempt, 100);
      };
      socket.once('error', retry);
      socket.once('timeout', retry);
    };

    child.once('error', listeners.onError);
    child.once('exit', listeners.onExit);
    attempt();
    await promise;
  };

  return { spawnProcess, terminateProcess, waitForPort };
};

const parseMode = (value: string | undefined): RuntimeMode | undefined => {
  const modes: RuntimeMode[] = ['build-local', 'dev', 'playwright-dev', 'playwright-start'];
  return modes.find((mode) => mode === value);
};

const main = async () => {
  const mode = parseMode(process.argv[2]);
  const modes: RuntimeMode[] = ['build-local', 'dev', 'playwright-dev', 'playwright-start'];

  if (!mode || !modes.includes(mode)) {
    throw new Error(`Expected one runtime mode: ${modes.join(', ')}`);
  }
  if (!process.env.npm_execpath) {
    throw new Error('This launcher must be run from an npm script');
  }

  const operations = createSystemOperations({ cwd: process.cwd(), platform: process.platform });
  const signalResolver = Promise.withResolvers<RuntimeSignal>();
  process.once('SIGINT', () => {
    signalResolver.resolve({ exitCode: 130, signal: 'SIGINT' });
  });
  process.once('SIGTERM', () => {
    signalResolver.resolve({ exitCode: 143, signal: 'SIGTERM' });
  });
  const exitCode = await runRuntime({ mode, operations, signal: signalResolver.promise });
  process.exitCode = exitCode;
};

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try {
    await main();
  } catch (error: unknown) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
