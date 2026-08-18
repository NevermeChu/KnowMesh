'use client';

import { Moon, Sun } from 'lucide-react';
import { useTransition } from 'react';
import { applyThemePreference } from '@/features/preferences/components/ApplyThemePreference';
import { isUserThemePreference } from '@/features/preferences/Preferences';
import { updateThemePreference } from '@/features/preferences/server/UpdateThemePreference';

/**
 * Renders the sidebar quick toggle that flips the resolved theme between light and dark.
 *
 * @param props - Optional presentation overrides for the shared toggle.
 * @returns The theme toggle icon button.
 */
export function ThemeToggle(props: {
  className?: string;
  iconClassName?: string;
  strokeWidth?: number;
  title?: string;
}) {
  const [, startTransition] = useTransition();

  function toggleTheme() {
    const root = document.documentElement;
    const previousPreference = isUserThemePreference(root.dataset.theme)
      ? root.dataset.theme
      : 'system';
    const nextTheme = root.classList.contains('dark') ? 'light' : 'dark';

    applyThemePreference(nextTheme);
    startTransition(async () => {
      try {
        await updateThemePreference({ theme: nextTheme });
      } catch {
        applyThemePreference(previousPreference);
      }
    });
  }

  return (
    <button
      type="button"
      aria-label={props.title ?? '切换主题'}
      title={props.title ?? '切换主题'}
      className={
        props.className ??
        'grid size-8 shrink-0 place-items-center rounded-lg text-ink-muted transition-colors hover:bg-overlay hover:text-ink'
      }
      onClick={toggleTheme}
    >
      <Moon
        aria-hidden="true"
        className={`${props.iconClassName ?? 'size-4'} dark:hidden`}
        strokeWidth={props.strokeWidth ?? 1.8}
      />
      <Sun
        aria-hidden="true"
        className={`hidden ${props.iconClassName ?? 'size-4'} dark:block`}
        strokeWidth={props.strokeWidth ?? 1.8}
      />
    </button>
  );
}
