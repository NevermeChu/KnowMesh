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
            // Ensure Clerk is compatible with Tailwind CSS v4 and theme embedded
            // auth components to match the KnowMesh palette.
            cssLayerName: 'clerk',
            variables: {
              colorPrimary: '#2383e2',
              colorForeground: '#2f3437',
              colorMutedForeground: '#777b80',
              colorInput: '#ffffff',
              colorInputForeground: '#2f3437',
              colorRing: '#2383e2',
              colorDanger: '#d14343',
              fontFamily:
                'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "PingFang SC", "Microsoft YaHei", sans-serif',
              borderRadius: '0.5rem',
            },
            elements: {
              card: 'border border-black/10 rounded-2xl shadow-[0_24px_80px_-32px_rgba(15,23,42,0.35)]',
              formButtonPrimary: 'rounded-lg font-semibold hover:bg-[#1f74c9]',
              formFieldInput: 'rounded-lg',
              socialButtonsButton: 'rounded-lg border-black/10 bg-white',
              headerTitle: 'text-[#202124]',
              headerSubtitle: 'text-[#777b80]',
              footerActionLink: 'text-[#2383e2] hover:text-[#1f74c9]',
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
