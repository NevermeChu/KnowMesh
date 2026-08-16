import { UserProfile } from '@clerk/nextjs';
import type { ComponentProps } from 'react';

/**
 * Fills the workspace content area like the document editor and dissolves Clerk's
 * standalone card chrome, so account management reads as an app view instead of an
 * embedded widget.
 */
const userProfileAppearance: ComponentProps<typeof UserProfile>['appearance'] = {
  elements: {
    rootBox: 'h-full w-full',
    cardBox: 'w-full',
    card: 'h-full rounded-none border-none bg-transparent shadow-none',
    navbar: 'gap-1',
    navbarButton:
      'justify-start rounded-lg border-none bg-transparent px-3 py-2 text-sm font-medium text-ink-muted shadow-none transition-colors hover:bg-overlay hover:text-ink',
    navbarButtonsContainer: 'gap-1',
    profileSection: 'rounded-lg border border-line bg-card',
    profileSectionTitle: 'text-sm font-semibold text-ink',
    headerTitle: 'text-base font-semibold text-ink',
    headerSubtitle: 'hidden',
    headerBackButton: 'text-accent hover:text-accent-strong',
    formButtonPrimary: 'rounded-lg font-semibold hover:bg-accent-strong',
    scrollBox: 'overflow-y-auto',
  },
};

export default function UserProfilePage() {
  return (
    <div className="-mx-5 h-[calc(100dvh-7rem)] sm:-mx-8 lg:-mx-12">
      <UserProfile appearance={userProfileAppearance} path="/settings/user-profile" />
    </div>
  );
}
