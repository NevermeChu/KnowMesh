import type { Metadata, Viewport } from 'next';
import '@/styles/global.css';
import { cookies } from 'next/headers';
import { ToastProvider } from '@/components/ui/Toast';
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
      sizes: '180x180',
      type: 'image/png',
      url: '/apple-touch-icon.png',
    },
    {
      rel: 'icon',
      sizes: '32x32',
      type: 'image/png',
      url: '/favicon-32x32.png',
    },
    {
      rel: 'icon',
      sizes: '16x16',
      type: 'image/png',
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
        <ToastProvider>{props.children}</ToastProvider>
      </body>
    </html>
  );
}
