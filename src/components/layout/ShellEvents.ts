import type { PermissionOverviewInput } from '@/features/projects/PermissionOverview';

export const TOGGLE_FULLSCREEN_EVENT = 'knowmesh:toggle-fullscreen';
export const OPEN_COMMAND_PALETTE_EVENT = 'knowmesh:open-command-palette';
export const OPEN_SHORTCUTS_HELP_EVENT = 'knowmesh:open-shortcuts-help';
export const OPEN_PERMISSION_OVERVIEW_EVENT = 'knowmesh:open-permission-overview';

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

/** Dispatches a custom event to open the keyboard shortcuts help dialog. */
export function openShortcutsHelp() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(OPEN_SHORTCUTS_HELP_EVENT));
  }
}

/**
 * Dispatches a custom event to open the permission overview dialog for a workspace or project.
 *
 * @param input - Permission overview scope and target resource identifier.
 */
export function openPermissionOverviewModal(input: PermissionOverviewInput) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(OPEN_PERMISSION_OVERVIEW_EVENT, { detail: input }));
  }
}
