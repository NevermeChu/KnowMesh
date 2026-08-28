import { spawnSync } from 'node:child_process';
import process from 'node:process';
import { setTimeout as delay } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';

const COLLABORATION_SHUTDOWN_TIMEOUT_MS = 17_000;
const PORT_RELEASE_TIMEOUT_MS = 2000;

const parsePid = (name: string): number | null => {
  const prefix = `--${name}=`;
  const value = process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length);
  if (!value) {
    return null;
  }
  const pid = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(pid) || pid <= 0) {
    throw new Error(`Invalid ${name} PID`);
  }
  return pid;
};

const parsePort = (name: string) => {
  const prefix = `--${name}=`;
  const value = process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length);
  const port = Number.parseInt(value ?? '', 10);
  if (!Number.isSafeInteger(port) || port <= 0 || port > 65_535) {
    throw new Error(`Invalid ${name}`);
  }
  return port;
};

const isRunning = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

const terminateTree = (pid: number) => {
  if (!isRunning(pid)) {
    return;
  }
  const result = spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], {
    stdio: 'ignore',
    windowsHide: true,
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0 && isRunning(pid)) {
    throw new Error(`Failed to terminate Windows process tree ${pid}`);
  }
};

const getRuntimePortOwners = (runtimePorts: ReadonlySet<number>) => {
  const result = spawnSync('netstat', ['-ano', '-p', 'TCP'], {
    encoding: 'utf-8',
    windowsHide: true,
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error('Failed to inspect Windows runtime ports');
  }

  const owners = new Set<number>();
  for (const line of result.stdout.split(/\r?\n/u)) {
    const columns = line.trim().split(/\s+/u);
    if (columns.length < 5 || columns.at(-2) !== 'LISTENING') {
      continue;
    }
    const localAddress = columns.at(-4);
    const pidText = columns.at(-1);
    const portText = localAddress?.slice((localAddress.lastIndexOf(':') ?? -1) + 1);
    const port = Number.parseInt(portText ?? '', 10);
    const pid = Number.parseInt(pidText ?? '', 10);
    if (runtimePorts.has(port) && Number.isSafeInteger(pid) && pid > 0) {
      owners.add(pid);
    }
  }
  return owners;
};

const waitForExitUntil = async (pid: number, timeoutMs: number) => {
  const deadline = Date.now() + timeoutMs;
  while (isRunning(pid) && Date.now() < deadline) {
    await delay(50);
  }
};

const releaseRuntimePorts = async (
  expectedOwners: ReadonlySet<number>,
  runtimePorts: ReadonlySet<number>,
) => {
  const deadline = Date.now() + PORT_RELEASE_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const owners = getRuntimePortOwners(runtimePorts);
    if (owners.size === 0) {
      return;
    }
    for (const pid of owners) {
      if (!expectedOwners.has(pid)) {
        throw new Error(`Unexpected process ${pid} owns a runtime port during cleanup`);
      }
      terminateTree(pid);
    }
    await delay(50);
  }
  if (getRuntimePortOwners(runtimePorts).size > 0) {
    throw new Error('Windows runtime ports remained occupied after cleanup');
  }
};

const main = async () => {
  const applicationPid = parsePid('application');
  const collaborationPid = parsePid('collaboration');
  const whiteboardCollaborationPid = parsePid('whiteboard-collaboration');
  const databasePid = parsePid('database');
  const runtimePorts = new Set([
    parsePort('application-port'),
    parsePort('collaboration-port'),
    parsePort('collaboration-health-port'),
    parsePort('whiteboard-collaboration-port'),
    parsePort('whiteboard-collaboration-health-port'),
    5432,
  ]);
  const expectedPortOwners = getRuntimePortOwners(runtimePorts);

  if (applicationPid) {
    terminateTree(applicationPid);
  }
  if (collaborationPid) {
    await waitForExitUntil(collaborationPid, COLLABORATION_SHUTDOWN_TIMEOUT_MS);
    terminateTree(collaborationPid);
  }
  if (whiteboardCollaborationPid) {
    await waitForExitUntil(whiteboardCollaborationPid, COLLABORATION_SHUTDOWN_TIMEOUT_MS);
    terminateTree(whiteboardCollaborationPid);
  }
  if (databasePid) {
    terminateTree(databasePid);
  }
  await releaseRuntimePorts(expectedPortOwners, runtimePorts);
};

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try {
    await main();
  } catch (error: unknown) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
