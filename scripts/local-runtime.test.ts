import { ChildProcess } from 'node:child_process';
import { describe, expect, it, vi } from 'vitest';
import { createCommands, runRuntime } from './local-runtime';
import type { RuntimeMode, RuntimeOperations } from './local-runtime';

const createChild = () => {
  const child = new ChildProcess();
  Object.assign(child, {
    exitCode: null,
    pid: 1,
    signalCode: null,
  });
  return child;
};

const exitChild = (child: ChildProcess, code = 0) => {
  Object.assign(child, { exitCode: code });
  child.emit('exit', code, null);
};

const getChild = (children: Map<string, ChildProcess[]>, name: string) => {
  const child = children.get(name)?.[0];
  if (!child) {
    throw new Error(`${name} did not start`);
  }
  return child;
};

const createRuntime = (mode: RuntimeMode) => {
  const commands: string[] = [];
  const children = new Map<string, ChildProcess[]>();
  const terminateProcess = vi.fn<RuntimeOperations['terminateProcess']>(async () => {
    await Promise.resolve();
  });
  const operations: RuntimeOperations = {
    spawnProcess: (command) => {
      commands.push(command.name);
      const child = createChild();
      children.set(command.name, [...(children.get(command.name) ?? []), child]);
      if (command.name === 'Database migration') {
        queueMicrotask(() => {
          exitChild(child);
        });
      }
      return child;
    },
    terminateProcess,
    waitForPort: vi.fn<RuntimeOperations['waitForPort']>(async () => {
      await Promise.resolve();
    }),
  };

  return {
    children,
    commands,
    mode,
    operations,
    terminateProcess,
  };
};

describe('Local runtime', () => {
  describe('Command construction', () => {
    it('uses Node executables without shell commands on Windows', () => {
      const commands = createCommands({
        cwd: 'C:\\project',
        mode: 'dev',
        nodePath: 'node.exe',
        npmCliPath: 'npm-cli.js',
      });

      expect(commands.database.command).toBe('node.exe');
      expect(commands.database.args).toContain('--db=local.db');
      expect(commands.database.args).not.toContain('--run');
      expect(commands.migration).toStrictEqual({
        args: ['npm-cli.js', 'run', 'db:migrate'],
        command: 'node.exe',
        name: 'Database migration',
      });
    });

    it('uses an in-memory database for local builds', () => {
      const commands = createCommands({
        cwd: '/project',
        mode: 'build-local',
        nodePath: '/usr/bin/node',
        npmCliPath: '/usr/lib/npm-cli.js',
      });

      expect(commands.database.args).not.toContain('--db=local.db');
      expect(commands.build.args).toStrictEqual(['/usr/lib/npm-cli.js', 'run', 'build:next']);
    });
  });

  describe('Development mode', () => {
    it('starts applications after migration', async () => {
      const runtime = createRuntime('dev');
      const result = runRuntime(runtime);
      await vi.waitFor(() => {
        expect(runtime.commands).toStrictEqual(['PGlite', 'Database migration', 'Next.js']);
      });

      exitChild(getChild(runtime.children, 'Next.js'), 1);

      await expect(result).resolves.toBe(1);
      expect(runtime.terminateProcess).toHaveBeenCalledOnce();
    });

    it('cleans children when interrupted', async () => {
      const runtime = createRuntime('dev');
      const signal = Promise.withResolvers<{ exitCode: number; signal: 'SIGINT' }>();
      const result = runRuntime({ ...runtime, signal: signal.promise });
      await vi.waitFor(() => {
        expect(runtime.commands).toHaveLength(3);
      });

      signal.resolve({ exitCode: 130, signal: 'SIGINT' });

      await expect(result).resolves.toBe(130);
      expect(runtime.terminateProcess).toHaveBeenCalledTimes(2);
    });
  });

  describe('Failure paths', () => {
    it('stops the database when migration fails', async () => {
      const runtime = createRuntime('dev');
      runtime.operations.spawnProcess = (command) => {
        runtime.commands.push(command.name);
        const child = createChild();
        runtime.children.set(command.name, [child]);
        if (command.name === 'Database migration') {
          queueMicrotask(() => {
            exitChild(child, 2);
          });
        }
        return child;
      };

      await expect(runRuntime(runtime)).rejects.toThrow('Database migration exited with code 2');
      expect(runtime.commands).toStrictEqual(['PGlite', 'Database migration']);
      expect(runtime.terminateProcess).toHaveBeenCalledOnce();
    });
  });
});
