export const TOGGLE_FULLSCREEN_EVENT = 'knowmesh:toggle-fullscreen';
export const OPEN_COMMAND_PALETTE_EVENT = 'knowmesh:open-command-palette';

/** Dispatches a custom event to toggle fullscreen zen mode. */
export function toggleZenMode() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(TOGGLE_FULLSCREEN_EVENT));
  }
}

/** Dispatches a custom event to open the global command palette from any trigger. */
export function openCommandPalette() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(OPEN_COMMAND_PALETTE_EVENT));
  }
}
