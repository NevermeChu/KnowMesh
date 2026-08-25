'use client';

import { clearDocumentCollaborationCachesForUser } from '@/features/documents/collaboration/DocumentCollaborationLocalPersistence';
import { authClient } from '@/libs/AuthClient';

/**
 * Renders a button that terminates the Better Auth session.
 *
 * @param props - Button content and caller-provided menu styling.
 * @returns The sign-out button.
 */
export function SignOutButton(props: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  userId: string;
}) {
  return (
    <button
      className={props.className}
      style={props.style}
      type="button"
      onClick={async () => {
        await clearDocumentCollaborationCachesForUser(props.userId);
        await authClient.signOut();
        window.location.assign('/');
      }}
    >
      {props.children}
    </button>
  );
}
