import type { ChildProcess, SpawnOptions } from 'node:child_process';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { connect } from 'node:net';
import { dirname, resolve } from 'node:path';
import process from 'node:process';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';

export type RuntimeMode = 'build-local' | 'dev' | 'playwright-dev' | 'playwright-start';

type Command = {
  args: string[];
  command: string;
  ipc?: boolean;
  name: string;
};

type ProcessResult = {
  code: number;
  signal: NodeJS.Signals | null;
};

export type RuntimeOperations = {
  spawnProcess: (command: Command) => ChildProcess;
  terminateProcess: (child: ChildProcess, timeoutMs?: number) => Promise<void>;
  terminateRuntimeProcesses?: (children: {
    application?: ChildProcess;
    collaboration?: ChildProcess;
    database?: ChildProcess;
  }) => Promise<void>;
  waitForCollaborationReady: (child: ChildProcess) => Promise<void>;
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
const COLLABORATION_HEALTH_REQUEST_TIMEOUT_MS = 1000;
const COLLABORATION_SHUTDOWN_TIMEOUT_MS = 17_000;

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
  const nextCliPath = fileURLToPath(import.meta.resolve('next/dist/bin/next'));
  const tsxCliPath = fileURLToPath(import.meta.resolve('tsx/cli'));
  const databaseArgs = [resolve(dirname(databasePackage), 'scripts/server.js'), '-m', '100'];

  if (options.mode === 'dev') {
    databaseArgs.push('--db=local.db');
  }

  const applicationCommand = options.mode === 'playwright-start' ? 'start' : 'dev';
  const collaborationArgs = [tsxCliPath];
  if (existsSync(resolve(options.cwd, '.env'))) {
    collaborationArgs.push('--env-file=.env');
  }
  collaborationArgs.push(resolve(options.cwd, 'scripts/collaboration-server.ts'));

  return {
    application: {
      args: [nextCliPath, applicationCommand],
      command: options.nodePath,
      name: 'Next.js',
    },
    build: npmCommand('Next.js build', 'build:next'),
    collaboration: {
      args: collaborationArgs,
      command: options.nodePath,
      ipc: true,
      name: 'Hocuspocus',
    },
    database: {
      args: databaseArgs,
      command: options.nodePath,
      name: 'PGlite',
    },
    migration: npmCommand('Database migration', 'db:migrate'),
  };
};

export const createSpawnOptions = (options: {
  command: Command;
  cwd: string;
  platform: NodeJS.Platform;
}): SpawnOptions => {
  const detached = !['Database migration', 'Next.js build'].includes(options.command.name);
  let stdio: SpawnOptions['stdio'] = 'inherit';
  if (detached) {
    stdio = options.command.ipc ? ['ignore', 'pipe', 'pipe', 'ipc'] : ['ignore', 'pipe', 'pipe'];
  }
  return {
    cwd: options.cwd,
    detached,
    env: process.env,
    shell: false,
    stdio,
    windowsHide: options.platform === 'win32',
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
  collaborationEnabled: boolean;
  manageDatabase: boolean;
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
  let applicationChild: ChildProcess | undefined;
  let collaborationChild: ChildProcess | undefined;
  let databaseChild: ChildProcess | undefined;
  let databaseExit: Promise<ProcessResult> | undefined;
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
      if (options.operations.terminateRuntimeProcesses) {
        await options.operations.terminateRuntimeProcesses({
          application: applicationChild,
          collaboration: collaborationChild,
          database: databaseChild,
        });
        return;
      }
      if (collaborationChild && children.has(collaborationChild)) {
        await options.operations.terminateProcess(
          collaborationChild,
          COLLABORATION_SHUTDOWN_TIMEOUT_MS,
        );
      }
      await Promise.all(
        [...children]
          .filter((child) => child !== collaborationChild)
          .map(async (child) => {
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
    if (options.manageDatabase) {
      const database = start(commands.database);
      databaseChild = database.child;
      databaseExit = database.exit;
      const readiness = await waitOrSignal(options.operations.waitForPort(database.child));
      if (isRuntimeSignal(readiness)) {
        return readiness.exitCode;
      }
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

    let collaborationExit: Promise<ProcessResult> | undefined;
    if (options.collaborationEnabled) {
      const collaboration = start(commands.collaboration);
      collaborationChild = collaboration.child;
      collaborationExit = collaboration.exit;
      const collaborationReadiness = await waitOrSignal(
        options.operations.waitForCollaborationReady(collaboration.child),
      );
      if (isRuntimeSignal(collaborationReadiness)) {
        return collaborationReadiness.exitCode;
      }
    }

    const application = start(commands.application);
    applicationChild = application.child;
    const runtimeExits = [application.exit];
    if (databaseExit) {
      runtimeExits.push(databaseExit);
    }
    if (collaborationExit) {
      runtimeExits.push(collaborationExit);
    }
    const result = await waitOrSignal(Promise.race(runtimeExits));
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

export const createWindowsTerminationArgs = (pid: number) => ['/PID', String(pid), '/T', '/F'];

const loadLocalEnvironment = () => {
  try {
    process.loadEnvFile('.env');
  } catch (error) {
    if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) {
      throw error;
    }
  }
};

export const createSystemOperations = (options: {
  cwd: string;
  platform: NodeJS.Platform;
}): RuntimeOperations => {
  const spawnProcess = (command: Command) => {
    const child = spawn(
      command.command,
      command.args,
      createSpawnOptions({ command, cwd: options.cwd, platform: options.platform }),
    );
    child.stdout?.pipe(process.stdout);
    child.stderr?.pipe(process.stderr);
    return child;
  };

  const terminateProcess = async (child: ChildProcess, timeoutMs = SHUTDOWN_TIMEOUT_MS) => {
    const { pid } = child;
    if (!pid || child.exitCode !== null || child.signalCode !== null) {
      return;
    }

    if (options.platform === 'win32') {
      if (child.connected) {
        child.send({ type: 'shutdown' });
        await waitForChildOrTimeout(child, timeoutMs);
        if (child.exitCode !== null || child.signalCode !== null) {
          return;
        }
      }

      const forceTerminateTree = () => {
        const result = spawnSync('taskkill', createWindowsTerminationArgs(pid), {
          stdio: 'ignore',
          windowsHide: true,
        });
        if (result.error) {
          throw result.error;
        }
        if (result.status !== 0) {
          throw new Error(`Failed to terminate Windows process tree ${pid}`);
        }
      };

      forceTerminateTree();
      await waitForChildOrTimeout(child, timeoutMs);
      if (child.exitCode === null && child.signalCode === null) {
        throw new Error(`Process tree ${pid} did not exit within ${timeoutMs}ms`);
      }
      return;
    }

    try {
      process.kill(-pid, 'SIGTERM');
    } catch (error) {
      if (!isMissingProcess(error)) {
        throw error;
      }
    }
    await waitForChildOrTimeout(child, timeoutMs);
    if (child.exitCode === null && child.signalCode === null) {
      try {
        process.kill(-pid, 'SIGKILL');
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

  const waitForCollaborationReady = async (child: ChildProcess) => {
    const address = process.env.COLLABORATION_ADDRESS ?? '127.0.0.1';
    const host = address.includes(':') && !address.startsWith('[') ? `[${address}]` : address;
    const port = process.env.COLLABORATION_HEALTH_PORT ?? '1235';
    const readinessUrl = `http://${host}:${port}/ready`;
    const startedAt = Date.now();

    while (Date.now() - startedAt < STARTUP_TIMEOUT_MS) {
      if (child.exitCode !== null || child.signalCode !== null) {
        throw new Error(`Hocuspocus exited before becoming ready with code ${child.exitCode ?? 1}`);
      }

      try {
        const response = await fetch(readinessUrl, {
          signal: AbortSignal.timeout(COLLABORATION_HEALTH_REQUEST_TIMEOUT_MS),
        });
        if (response.ok) {
          const result: unknown = await response.json();
          if (
            typeof result === 'object' &&
            result !== null &&
            'status' in result &&
            result.status === 'ready'
          ) {
            return;
          }
        }
      } catch {
        // The service may still be binding its health port or waiting for the database.
      }

      await delay(100);
    }

    throw new Error(`Hocuspocus did not become ready within ${STARTUP_TIMEOUT_MS}ms`);
  };

  const terminateRuntimeProcesses = async (children: {
    application?: ChildProcess;
    collaboration?: ChildProcess;
    database?: ChildProcess;
  }) => {
    if (options.platform !== 'win32') {
      throw new Error('Detached runtime cleanup is only available on Windows');
    }

    const cleanupScript = resolve(options.cwd, 'scripts/windows-runtime-cleanup.ts');
    const args = [cleanupScript];
    if (children.application?.pid) {
      args.push(`--application=${children.application.pid}`);
    }
    if (children.collaboration?.pid) {
      args.push(`--collaboration=${children.collaboration.pid}`);
    }
    if (children.database?.pid) {
      args.push(`--database=${children.database.pid}`);
    }
    args.push(
      `--application-port=${process.env.PORT ?? '3000'}`,
      `--collaboration-port=${process.env.COLLABORATION_PORT ?? '1234'}`,
      `--collaboration-health-port=${process.env.COLLABORATION_HEALTH_PORT ?? '1235'}`,
    );
    const cleanup = spawn(process.execPath, args, {
      cwd: options.cwd,
      detached: true,
      env: process.env,
      shell: false,
      stdio: 'ignore',
      windowsHide: true,
    });
    if (children.collaboration?.connected) {
      children.collaboration.send({ type: 'shutdown' });
    }
    const result = await waitForExit(cleanup);
    if (result.code !== 0) {
      throw new Error(`Windows runtime cleanup exited with code ${result.code}`);
    }
  };

  return {
    spawnProcess,
    terminateProcess,
    ...(options.platform === 'win32' ? { terminateRuntimeProcesses } : {}),
    waitForCollaborationReady,
    waitForPort,
  };
};

const parseMode = (value: string | undefined): RuntimeMode | undefined => {
  const modes: RuntimeMode[] = ['build-local', 'dev', 'playwright-dev', 'playwright-start'];
  return modes.find((mode) => mode === value);
};

const main = async () => {
  loadLocalEnvironment();
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
  const exitCode = await runRuntime({
    collaborationEnabled: process.env.COLLABORATION_ENABLED === 'true',
    manageDatabase: process.env.E2E_REAL_POSTGRES !== 'true',
    mode,
    operations,
    signal: signalResolver.promise,
  });
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
