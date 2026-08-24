import childProcess from 'node:child_process';
import process from 'node:process';

const preloadUrl = process.env.KNOWMESH_WINDOWS_CHILD_PRELOAD;

const isArgumentList = (
  value: readonly string[] | childProcess.ForkOptions | undefined,
): value is readonly string[] => Array.isArray(value);

const createForkStdio = (options: childProcess.ForkOptions): childProcess.SpawnOptions['stdio'] => {
  if (Array.isArray(options.stdio)) {
    return options.stdio.includes('ipc') ? options.stdio : [...options.stdio, 'ipc'];
  }

  const stdio = options.stdio ?? (options.silent ? 'pipe' : 'inherit');
  return [stdio, stdio, stdio, 'ipc'];
};

if (process.platform === 'win32' && preloadUrl) {
  Object.defineProperty(childProcess, 'fork', {
    configurable: true,
    value: (
      modulePath: string | URL,
      argsOrOptions?: readonly string[] | childProcess.ForkOptions,
      options?: childProcess.ForkOptions,
    ) => {
      const forkArgs = isArgumentList(argsOrOptions) ? argsOrOptions : [];
      const forkOptions = isArgumentList(argsOrOptions) ? (options ?? {}) : (argsOrOptions ?? {});
      const executable = forkOptions.execPath ?? process.execPath;
      const execArgs = forkOptions.execArgv ?? process.execArgv;
      const {
        execArgv: _execArgv,
        execPath: _execPath,
        silent: _silent,
        ...spawnOptions
      } = forkOptions;

      return childProcess.spawn(executable, [...execArgs, modulePath.toString(), ...forkArgs], {
        ...spawnOptions,
        shell: false,
        stdio: createForkStdio(forkOptions),
        windowsHide: true,
      });
    },
    writable: true,
  });

  const nodeOptions = process.env.NODE_OPTIONS?.trim();
  const importOption = `--import=${preloadUrl}`;
  if (!nodeOptions?.includes(importOption)) {
    process.env.NODE_OPTIONS = nodeOptions ? `${nodeOptions} ${importOption}` : importOption;
  }
}
