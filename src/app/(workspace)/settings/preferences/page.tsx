import { ThemePreferenceSection } from '@/features/preferences/components/ThemePreferenceSection';
import { getUserPreferences } from '@/features/preferences/server/GetUserPreferences';

export default async function PreferencesPage() {
  const preferences = await getUserPreferences();

  return (
    <div className="mx-auto w-full max-w-4xl py-10 sm:py-14">
      <header className="border-b border-line-soft pb-5">
        <p className="text-xs font-semibold tracking-[0.12em] text-ink-faint uppercase">设置</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink">系统偏好设置</h1>
        <p className="mt-1 text-sm text-ink-muted">管理 KnowMesh 的外观与使用偏好。</p>
      </header>
      <section className="mt-8">
        <h2 className="text-sm font-semibold text-ink">外观</h2>
        <p className="mt-1 text-sm text-ink-muted">选择界面主题，更改会立即保存并全站生效。</p>
        <ThemePreferenceSection theme={preferences.theme} />
      </section>
    </div>
  );
}
