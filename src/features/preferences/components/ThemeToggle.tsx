'use client';

import { Moon, Sun } from 'lucide-react';
import { useTransition } from 'react';
import { applyThemePreference } from '@/features/preferences/components/ApplyThemePreference';
import { isUserThemePreference } from '@/features/preferences/Preferences';
import { updateThemePreference } from '@/features/preferences/server/UpdateThemePreference';

/**
 * Renders the sidebar quick toggle that flips the resolved theme between light and dark.
 *
 * @returns The theme toggle icon button.
 */
export function ThemeToggle() {
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
      aria-label="切换主题"
      title="切换主题"
      className="grid size-8 shrink-0 place-items-center rounded-lg text-ink-muted transition-colors hover:bg-overlay hover:text-ink"
      onClick={toggleTheme}
    >
      <Moon aria-hidden="true" className="size-4 dark:hidden" strokeWidth={1.8} />
      <Sun aria-hidden="true" className="hidden size-4 dark:block" strokeWidth={1.8} />
    </button>
  );
}
