'use client';

import { Monitor, Moon, Sun } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useState, useTransition } from 'react';
import { applyThemePreference } from '@/features/preferences/components/ApplyThemePreference';
import type { UserThemePreference } from '@/features/preferences/Preferences';
import { updateThemePreference } from '@/features/preferences/server/UpdateThemePreference';

type ThemeOption = {
  description: string;
  icon: LucideIcon;
  label: string;
  value: UserThemePreference;
};

const themeOptions: ThemeOption[] = [
  { description: '明亮清爽的经典配色', icon: Sun, label: '浅色', value: 'light' },
  { description: '适合昏暗环境的深色配色', icon: Moon, label: '深色', value: 'dark' },
  { description: '与操作系统外观设置保持一致', icon: Monitor, label: '跟随系统', value: 'system' },
];

/**
 * Renders the appearance section of system preferences: theme cards persisted per user.
 *
 * @param props - Currently persisted theme preference.
 * @returns The theme option cards with optimistic switching and failure rollback.
 */
export function ThemePreferenceSection(props: { theme: UserThemePreference }) {
  const [selectedTheme, setSelectedTheme] = useState(props.theme);
  const [error, setError] = useState<string>();
  const [isPending, startTransition] = useTransition();

  function selectTheme(theme: UserThemePreference) {
    const previousTheme = selectedTheme;

    if (theme === previousTheme) {
      return;
    }

    setSelectedTheme(theme);
    setError(undefined);
    applyThemePreference(theme);
    startTransition(async () => {
      try {
        await updateThemePreference({ theme });
      } catch {
        setSelectedTheme(previousTheme);
        applyThemePreference(previousTheme);
        setError('保存偏好失败，请稍后重试');
      }
    });
  }

  return (
    <div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {themeOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-label={`${option.label}主题`}
            aria-pressed={option.value === selectedTheme}
            disabled={isPending}
            onClick={() => {
              selectTheme(option.value);
            }}
            className={`flex h-28 flex-col items-start justify-between rounded-lg border p-4 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${
              option.value === selectedTheme
                ? 'border-accent bg-accent-soft'
                : 'border-line bg-card hover:bg-overlay'
            }`}
          >
            <option.icon
              aria-hidden="true"
              className={`size-5 ${option.value === selectedTheme ? 'text-accent' : 'text-ink-muted'}`}
              strokeWidth={1.8}
            />
            <span>
              <span className="block text-sm font-medium text-ink">{option.label}</span>
              <span className="mt-0.5 block text-xs text-ink-muted">{option.description}</span>
            </span>
          </button>
        ))}
      </div>
      <p className="mt-3 min-h-4 text-sm text-danger" role="alert">
        {error}
      </p>
    </div>
  );
}
