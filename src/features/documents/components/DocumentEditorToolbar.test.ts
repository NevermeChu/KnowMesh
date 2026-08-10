import { describe, expect, it, vi } from 'vitest';
import type { DocumentEditorCommand } from './DocumentEditorToolbar';
import { partitionDocumentEditorCommands } from './DocumentEditorToolbar';

const createCommand = (
  label: string,
  toolbar: DocumentEditorCommand['toolbar'],
): DocumentEditorCommand => ({
  icon: null,
  label,
  onSelect: vi.fn<() => void>(),
  toolbar,
});

describe('document editor toolbar commands', () => {
  it('limits primary commands to eight', () => {
    const commands = Array.from({ length: 10 }, (_, index) =>
      createCommand(`format-${index}`, 'primary'),
    );

    const groups = partitionDocumentEditorCommands(commands);

    expect(groups.primary).toHaveLength(8);
    expect(groups.overflow.map((command) => command.label)).toStrictEqual(['format-8', 'format-9']);
  });

  it('keeps history commands separate', () => {
    const groups = partitionDocumentEditorCommands([
      createCommand('bold', 'primary'),
      createCommand('heading', 'overflow'),
      createCommand('undo', 'history'),
      createCommand('redo', 'history'),
    ]);

    expect(groups.primary.map((command) => command.label)).toStrictEqual(['bold']);
    expect(groups.overflow.map((command) => command.label)).toStrictEqual(['heading']);
    expect(groups.history.map((command) => command.label)).toStrictEqual(['undo', 'redo']);
  });
});
