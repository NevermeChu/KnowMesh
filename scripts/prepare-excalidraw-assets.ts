import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const repositoryRoot = resolve(import.meta.dirname, '..');
const sourceDirectory = resolve(
  repositoryRoot,
  'node_modules/@excalidraw/excalidraw/dist/prod/fonts',
);
const targetDirectory = resolve(repositoryRoot, 'public/excalidraw-assets/fonts');

if (!existsSync(sourceDirectory)) {
  throw new Error('Excalidraw font assets are unavailable; install dependencies first');
}

mkdirSync(dirname(targetDirectory), { recursive: true });
rmSync(targetDirectory, { force: true, recursive: true });
cpSync(sourceDirectory, targetDirectory, { recursive: true });
