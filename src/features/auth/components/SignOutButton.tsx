'use client';

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
}) {
  return (
    <button
      className={props.className}
      style={props.style}
      type="button"
      onClick={async () => {
        await authClient.signOut();
        window.location.assign('/');
      }}
    >
      {props.children}
    </button>
  );
}
