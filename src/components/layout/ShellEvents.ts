import type { PermissionOverviewInput } from '@/features/projects/PermissionOverview';

export const TOGGLE_FULLSCREEN_EVENT = 'knowmesh:toggle-fullscreen';
export const OPEN_COMMAND_PALETTE_EVENT = 'knowmesh:open-command-palette';
export const OPEN_SHORTCUTS_HELP_EVENT = 'knowmesh:open-shortcuts-help';
export const OPEN_PERMISSION_OVERVIEW_EVENT = 'knowmesh:open-permission-overview';
export const REFRESH_DOCUMENT_NAVIGATION_NODE_EVENT = 'knowmesh:refresh-document-navigation-node';

export type DocumentNavigationNodeRefresh = {
  parentId: string | null;
  projectId: string;
};

export function isDocumentNavigationNodeRefresh(
  value: unknown,
): value is DocumentNavigationNodeRefresh {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  return (
    'projectId' in value &&
    typeof value.projectId === 'string' &&
    'parentId' in value &&
    (value.parentId === null || typeof value.parentId === 'string')
  );
}

/** Dispatches a custom event to toggle fullscreen zen mode. */
export function toggleZenMode() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(TOGGLE_FULLSCREEN_EVENT));
  }
}

let pendingCommandPaletteOpen = false;

/** Dispatches a custom event to open the global command palette from any trigger. */
export function openCommandPalette() {
  if (typeof window === 'undefined') {
    return;
  }

  pendingCommandPaletteOpen = true;
  window.dispatchEvent(new CustomEvent(OPEN_COMMAND_PALETTE_EVENT));
}

/**
 * Consumes a palette-open request that fired before the palette listener mounted.
 *
 * @returns Whether a pending open should be applied on mount.
 */
export function takePendingCommandPaletteOpen() {
  if (!pendingCommandPaletteOpen) {
    return false;
  }

  pendingCommandPaletteOpen = false;
  return true;
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

/**
 * Requests a local refresh of one document-navigation parent node.
 *
 * @param input - Project and parent node to reload.
 */
export function refreshDocumentNavigationNode(input: DocumentNavigationNodeRefresh) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(REFRESH_DOCUMENT_NAVIGATION_NODE_EVENT, { detail: input }),
    );
  }
}
