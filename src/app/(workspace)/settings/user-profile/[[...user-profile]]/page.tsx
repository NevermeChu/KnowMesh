import { UserProfile } from '@clerk/nextjs';
import type { ComponentProps } from 'react';

/**
 * Dissolves Clerk's standalone card chrome so the profile blends into the shared
 * settings page frame and uses the KnowMesh theme tokens.
 */
const userProfileAppearance: ComponentProps<typeof UserProfile>['appearance'] = {
  elements: {
    rootBox: 'w-full',
    card: 'rounded-none border-none bg-transparent shadow-none',
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
  },
};

export default function UserProfilePage() {
  return (
    <div className="mx-auto w-full max-w-4xl py-10 sm:py-14">
      <header className="border-b border-line-soft pb-5">
        <p className="text-xs font-semibold tracking-[0.12em] text-ink-faint uppercase">设置</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink">账号设置</h1>
        <p className="mt-1 text-sm text-ink-muted">
          管理你的账号资料、安全与登录方式，由 Clerk 提供账户管理。
        </p>
      </header>
      <div className="mt-8">
        <UserProfile appearance={userProfileAppearance} path="/settings/user-profile" />
      </div>
    </div>
  );
}
