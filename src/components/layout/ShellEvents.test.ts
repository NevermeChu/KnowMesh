import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  OPEN_COMMAND_PALETTE_EVENT,
  OPEN_SHORTCUTS_HELP_EVENT,
  openCommandPalette,
  openShortcutsHelp,
  TOGGLE_FULLSCREEN_EVENT,
  toggleZenMode,
} from './ShellEvents';

describe('ShellEvents', () => {
  const dispatchMock = vi.fn<(event: Event) => boolean>();

  beforeEach(() => {
    vi.stubGlobal('window', {
      dispatchEvent: dispatchMock,
    });
    vi.stubGlobal(
      'CustomEvent',
      class MockCustomEvent {
        type: string;

        constructor(type: string) {
          this.type = type;
        }
      },
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    dispatchMock.mockReset();
  });

  it('dispatches fullscreen event on toggleZenMode', () => {
    toggleZenMode();
    expect(dispatchMock).toHaveBeenCalledWith(
      expect.objectContaining({ type: TOGGLE_FULLSCREEN_EVENT }),
    );
  });

  it('dispatches command palette event on openCommandPalette', () => {
    openCommandPalette();
    expect(dispatchMock).toHaveBeenCalledWith(
      expect.objectContaining({ type: OPEN_COMMAND_PALETTE_EVENT }),
    );
  });

  it('dispatches shortcuts help event on openShortcutsHelp', () => {
    openShortcutsHelp();
    expect(dispatchMock).toHaveBeenCalledWith(
      expect.objectContaining({ type: OPEN_SHORTCUTS_HELP_EVENT }),
    );
  });
});
