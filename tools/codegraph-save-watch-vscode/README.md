# CodeGraph Save Watch

This local VS Code extension runs a configured workspace command after a file is saved.

## Configuration

Create `codegraph.watch.json` in the workspace root:

```json
{
  "watchFolders": ["src", "scripts"],
  "command": "codegraph sync .",
  "debounceMs": 500,
  "ignored": ["src/generated"]
}
```

- Only saved files inside `watchFolders` trigger the command.
- Paths in `ignored` are excluded from those folders.
- The configured command must be available in the VS Code extension host's `PATH`.
- Commands run serially in the workspace root and write to the **CodeGraph Save Watch** output channel.
- The extension does not execute commands in untrusted workspaces.

## Local installation

Run `package.ps1`, then install the generated VSIX:

```powershell
.\package.ps1
code --install-extension .\codegraph-save-watch-0.1.1.vsix
```

Reload VS Code after installation. Opening a workspace containing `codegraph.watch.json` activates the extension automatically.
