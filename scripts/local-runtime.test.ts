import { ChildProcess } from 'node:child_process';
import type { Serializable } from 'node:child_process';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createCommands,
  createSpawnOptions,
  createSystemOperations,
  createWindowsTerminationArgs,
  runRuntime,
} from './local-runtime';
import type { RuntimeOperations } from './local-runtime';

function createChild(options?: { connected?: boolean; pid?: number }) {
  const child = new ChildProcess();
  Object.defineProperties(child, {
    connected: { configurable: true, value: options?.connected ?? false, writable: true },
    exitCode: { configurable: true, value: null, writable: true },
    pid: { configurable: true, value: options?.pid ?? 100, writable: true },
    signalCode: { configurable: true, value: null, writable: true },
  });
  return child;
}

function exitChild(child: ChildProcess, code = 0) {
  Object.defineProperty(child, 'exitCode', { configurable: true, value: code, writable: true });
  child.emit('exit', code, null);
}

describe('local runtime collaboration orchestration', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('creates a direct IPC collaboration command', () => {
    const commands = createCommands({
      cwd: 'D:/KnowMesh',
      mode: 'dev',
      nodePath: 'node',
      npmCliPath: 'npm-cli.js',
    });

    expect(commands.collaboration).toMatchObject({
      command: 'node',
      ipc: true,
      name: 'Hocuspocus',
    });
    expect(commands.collaboration.args.at(-1)).toMatch(/scripts[\\/]collaboration-server\.ts$/u);
    expect(commands.application).toMatchObject({
      args: [expect.stringMatching(/next[\\/]dist[\\/]bin[\\/]next$/u), 'dev'],
      command: 'node',
      name: 'Next.js',
    });
  });

  it('isolates Windows children from console shutdown signals', () => {
    const commands = createCommands({
      cwd: 'D:/KnowMesh',
      mode: 'dev',
      nodePath: 'node',
      npmCliPath: 'npm-cli.js',
    });

    expect(
      createSpawnOptions({ command: commands.database, cwd: 'D:/KnowMesh', platform: 'win32' }),
    ).toMatchObject({ detached: true, windowsHide: true });
    expect(
      createSpawnOptions({ command: commands.migration, cwd: 'D:/KnowMesh', platform: 'win32' }),
    ).toMatchObject({ detached: false, windowsHide: true });
  });

  it('forces the complete Windows process tree to exit', () => {
    expect(createWindowsTerminationArgs(123)).toStrictEqual(['/PID', '123', '/T', '/F']);
  });

  it('starts collaboration after migration and before Next.js', async () => {
    const started: string[] = [];
    const terminated: { name: string; timeoutMs?: number }[] = [];
    const childNames = new Map<ChildProcess, string>();
    const signal = Promise.withResolvers<{ exitCode: number; signal: NodeJS.Signals }>();
    const operations: RuntimeOperations = {
      spawnProcess(command) {
        const child = createChild();
        childNames.set(child, command.name);
        started.push(command.name);
        if (command.name === 'Database migration') {
          queueMicrotask(() => {
            exitChild(child);
          });
        }
        if (command.name === 'Next.js') {
          queueMicrotask(() => {
            signal.resolve({ exitCode: 130, signal: 'SIGINT' });
          });
        }
        return child;
      },
      async terminateProcess(child, timeoutMs) {
        terminated.push({ name: childNames.get(child) ?? 'unknown', timeoutMs });
        await Promise.resolve();
      },
      waitForCollaborationReady: async () => {
        await Promise.resolve();
      },
      waitForPort: async () => {
        await Promise.resolve();
      },
    };

    await expect(
      runRuntime({
        collaborationEnabled: true,
        manageDatabase: true,
        mode: 'dev',
        operations,
        signal: signal.promise,
      }),
    ).resolves.toBe(130);

    expect(started).toStrictEqual(['PGlite', 'Database migration', 'Hocuspocus', 'Next.js']);
    expect(terminated[0]).toStrictEqual({ name: 'Hocuspocus', timeoutMs: 17_000 });
    expect(terminated.map((item) => item.name)).toStrictEqual(
      expect.arrayContaining(['Hocuspocus', 'Next.js', 'PGlite']),
    );
  });

  it('skips collaboration when the feature flag is disabled', async () => {
    const started: string[] = [];
    const signal = Promise.withResolvers<{ exitCode: number; signal: NodeJS.Signals }>();
    const operations: RuntimeOperations = {
      spawnProcess(command) {
        const child = createChild();
        started.push(command.name);
        if (command.name === 'Database migration') {
          queueMicrotask(() => {
            exitChild(child);
          });
        }
        if (command.name === 'Next.js') {
          queueMicrotask(() => {
            signal.resolve({ exitCode: 130, signal: 'SIGINT' });
          });
        }
        return child;
      },
      terminateProcess: async () => {
        await Promise.resolve();
      },
      waitForCollaborationReady: async () => {
        await Promise.reject(new Error('Collaboration readiness must not run'));
      },
      waitForPort: async () => {
        await Promise.resolve();
      },
    };

    await runRuntime({
      collaborationEnabled: false,
      manageDatabase: true,
      mode: 'dev',
      operations,
      signal: signal.promise,
    });

    expect(started).not.toContain('Hocuspocus');
  });

  it('uses an external database for real PostgreSQL E2E', async () => {
    const started: string[] = [];
    const signal = Promise.withResolvers<{ exitCode: number; signal: NodeJS.Signals }>();
    const operations: RuntimeOperations = {
      spawnProcess(command) {
        const child = createChild();
        started.push(command.name);
        if (command.name === 'Database migration') {
          queueMicrotask(() => {
            exitChild(child);
          });
        }
        if (command.name === 'Next.js') {
          queueMicrotask(() => {
            signal.resolve({ exitCode: 130, signal: 'SIGINT' });
          });
        }
        return child;
      },
      terminateProcess: async () => {
        await Promise.resolve();
      },
      waitForCollaborationReady: async () => {
        await Promise.resolve();
      },
      waitForPort: async () => {
        await Promise.reject(new Error('Managed database readiness must not run'));
      },
    };

    await expect(
      runRuntime({
        collaborationEnabled: true,
        manageDatabase: false,
        mode: 'playwright-start',
        operations,
        signal: signal.promise,
      }),
    ).resolves.toBe(130);

    expect(started).toStrictEqual(['Database migration', 'Hocuspocus', 'Next.js']);
  });

  it('waits for the collaboration readiness response', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ status: 'ready' }, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const operations = createSystemOperations({ cwd: process.cwd(), platform: 'linux' });

    await operations.waitForCollaborationReady(createChild());

    expect(fetchMock).toHaveBeenCalledWith('http://127.0.0.1:1235/ready', {
      signal: expect.any(AbortSignal),
    });
  });

  it('requests IPC shutdown before terminating a Windows process tree', async () => {
    const child = createChild({ connected: true });
    const send = vi.fn<(message: Serializable) => boolean>(() => {
      queueMicrotask(() => {
        exitChild(child);
      });
      return true;
    });
    Object.defineProperty(child, 'send', {
      configurable: true,
      value: send,
      writable: true,
    });
    const operations = createSystemOperations({ cwd: process.cwd(), platform: 'win32' });

    await operations.terminateProcess(child, 1000);

    expect(send).toHaveBeenCalledWith({ type: 'shutdown' });
  });
});
