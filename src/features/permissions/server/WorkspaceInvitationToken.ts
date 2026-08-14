import { createHash } from 'node:crypto';

/**
 * Hashes a workspace invitation bearer token before database comparison.
 *
 * @param token - Raw invitation bearer token.
 * @returns The SHA-256 token digest.
 */
export function hashWorkspaceInvitationToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}
