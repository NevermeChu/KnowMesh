import { zhCN } from '@clerk/localizations';
import { ClerkProvider } from '@clerk/nextjs';
import '@/styles/global.css';
import type { Metadata, Viewport } from 'next';
import { GlobalContextMenuBoundary } from '@/components/layout/GlobalContextMenuBoundary';

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

export default function RootLayout(props: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <ClerkProvider
          localization={zhCN}
          appearance={{
            cssLayerName: 'clerk', // Ensure Clerk is compatible with Tailwind CSS v4
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
