/* oxlint-disable typescript/no-unsafe-argument, typescript/no-unsafe-return -- The VS Code API is provided dynamically by the extension host. */
const { spawn } = require('node:child_process');
const { readFile } = require('node:fs/promises');
const path = require('node:path');
const vscode = require('vscode');

const { matchesSavedFile, parseConfig } = require('./core.cjs');

const CONFIG_FILE = 'codegraph.watch.json';

class WorkspaceRunner {
  constructor(root, output) {
    this.root = root;
    this.output = output;
    this.child = null;
    this.configError = null;
    this.debounceTimer = null;
    this.pendingConfig = null;
    this.rerunRequested = false;
  }

  async loadConfig() {
    const configPath = path.join(this.root, CONFIG_FILE);
    try {
      const value = JSON.parse(await readFile(configPath, 'utf-8'));
      const config = parseConfig(value);
      if (this.configError) {
        this.output.appendLine('Configuration is valid again.');
      }
      this.configError = null;
      return config;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message !== this.configError) {
        this.configError = message;
        this.output.appendLine(`Invalid ${CONFIG_FILE}: ${message}`);
        void vscode.window.showErrorMessage(`CodeGraph Save Watch: ${message}`);
      }
      return null;
    }
  }

  async handleSave(filePath) {
    if (path.resolve(filePath) === path.join(this.root, CONFIG_FILE)) {
      await this.loadConfig();
      return;
    }

    const config = await this.loadConfig();
    if (!config || !matchesSavedFile({ config, filePath, root: this.root })) {
      return;
    }

    this.output.appendLine(`File saved: ${path.relative(this.root, filePath)}`);
    this.pendingConfig = config;
    clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.runPendingCommand();
    }, config.debounceMs);
  }

  runPendingCommand() {
    const config = this.pendingConfig;
    if (!config) {
      return;
    }
    if (this.child) {
      this.rerunRequested = true;
      return;
    }

    this.pendingConfig = null;
    this.output.appendLine(`Running: ${config.command}`);
    const child = spawn(config.command, {
      cwd: this.root,
      shell: true,
      windowsHide: true,
    });
    this.child = child;
    child.stdout?.on('data', (chunk) => {
      this.output.append(chunk.toString());
    });
    child.stderr?.on('data', (chunk) => {
      this.output.append(chunk.toString());
    });

    let settled = false;
    const finish = (exitCode, error) => {
      if (settled) {
        return;
      }
      settled = true;
      this.child = null;
      if (error) {
        this.output.appendLine(`Failed to start command: ${error.message}`);
        void vscode.window.showErrorMessage(`CodeGraph Save Watch: ${error.message}`);
      } else {
        this.output.appendLine(`Command exited with code ${exitCode ?? 1}.`);
        if (exitCode !== 0) {
          void vscode.window.showWarningMessage(
            `CodeGraph Save Watch command exited with code ${exitCode ?? 1}.`,
          );
        }
      }

      if (this.rerunRequested) {
        this.rerunRequested = false;
        this.runPendingCommand();
      }
    };
    child.once('error', (error) => {
      finish(null, error);
    });
    child.once('exit', (exitCode) => {
      finish(exitCode);
    });
  }

  dispose() {
    clearTimeout(this.debounceTimer);
    this.child?.kill();
  }
}

const activate = (context) => {
  const output = vscode.window.createOutputChannel('CodeGraph Save Watch');
  const runners = new Map();
  const getRunner = (workspaceFolder) => {
    const root = workspaceFolder.uri.fsPath;
    let runner = runners.get(root);
    if (!runner) {
      runner = new WorkspaceRunner(root, output);
      runners.set(root, runner);
    }
    return runner;
  };

  output.appendLine('CodeGraph Save Watch activated.');
  context.subscriptions.push(
    output,
    vscode.commands.registerCommand('codegraphSaveWatch.showOutput', () => {
      output.show();
    }),
    vscode.workspace.onDidSaveTextDocument((document) => {
      if (document.uri.scheme !== 'file') {
        return;
      }
      const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
      if (workspaceFolder) {
        void getRunner(workspaceFolder).handleSave(document.uri.fsPath);
      }
    }),
    {
      dispose: () => {
        for (const runner of runners.values()) {
          runner.dispose();
        }
      },
    },
  );
};

module.exports = { activate };
