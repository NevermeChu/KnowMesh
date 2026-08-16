import { zhCN } from '@clerk/localizations';
import { ClerkProvider } from '@clerk/nextjs';
import type { Metadata, Viewport } from 'next';
import '@/styles/global.css';
import { cookies } from 'next/headers';
import { GlobalContextMenuBoundary } from '@/components/layout/GlobalContextMenuBoundary';
import {
  CONTENT_WIDTH_COOKIE,
  isUserThemePreference,
  parseContentWidth,
  THEME_COOKIE,
} from '@/features/preferences/Preferences';
import type { UserThemePreference } from '@/features/preferences/Preferences';

type RootLayoutStyle = React.CSSProperties & {
  '--content-read-width': string;
};

export const metadata: Metadata = {
  icons: [
    {
      rel: 'apple-touch-icon',
      url: '/apple-touch-icon.png',
    },
    {
      rel: 'icon',
      type: 'image/png',
      sizes: '32x32',
      url: '/favicon-32x32.png',
    },
    {
      rel: 'icon',
      type: 'image/png',
      sizes: '16x16',
      url: '/favicon-16x16.png',
    },
    {
      rel: 'icon',
      url: '/favicon.ico',
    },
  ],
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

/** Resolves `system` against the OS preference before first paint and follows live changes. */
const themeInitScript = `(function(){var d=document.documentElement,m=window.matchMedia('(prefers-color-scheme: dark)'),r=function(){var t=d.dataset.theme;d.classList.toggle('dark',t==='dark'||(t!=='light'&&m.matches))};r();m.addEventListener('change',r);})();`;

export default async function RootLayout(props: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const themeCookie = cookieStore.get(THEME_COOKIE)?.value;
  const theme: UserThemePreference = isUserThemePreference(themeCookie) ? themeCookie : 'system';
  const contentWidth = parseContentWidth(cookieStore.get(CONTENT_WIDTH_COOKIE)?.value);
  const rootStyle: RootLayoutStyle = { '--content-read-width': `${contentWidth}%` };

  return (
    <html
      lang="zh-CN"
      className={theme === 'dark' ? 'dark' : undefined}
      data-theme={theme}
      style={rootStyle}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <ClerkProvider
          localization={zhCN}
          appearance={{
            // Ensure Clerk is compatible with Tailwind CSS v4 and theme embedded
            // auth components to match the KnowMesh palette.
            cssLayerName: 'clerk',
            variables: {
              colorPrimary: 'var(--accent)',
              colorBackground: 'var(--card)',
              colorForeground: 'var(--ink)',
              colorMutedForeground: 'var(--ink-muted)',
              colorInput: 'var(--card)',
              colorInputForeground: 'var(--ink)',
              colorRing: 'var(--accent)',
              colorDanger: 'var(--danger)',
              fontFamily:
                'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "PingFang SC", "Microsoft YaHei", sans-serif',
              borderRadius: '0.5rem',
            },
            elements: {
              card: 'border border-line rounded-xl shadow-overlay',
              formButtonPrimary: 'rounded-lg font-semibold hover:bg-accent-strong',
              formFieldInput: 'rounded-lg',
              socialButtonsButton: 'rounded-lg border-line bg-card',
              headerTitle: 'text-ink',
              headerSubtitle: 'text-ink-muted',
              footerActionLink: 'text-accent hover:text-accent-strong',
            },
          }}
          signInUrl="/sign-in"
          signUpUrl="/sign-up"
          signInFallbackRedirectUrl="/"
          signUpFallbackRedirectUrl="/"
          afterSignOutUrl="/"
        >
          <GlobalContextMenuBoundary>{props.children}</GlobalContextMenuBoundary>
        </ClerkProvider>
      </body>
    </html>
  );
}
