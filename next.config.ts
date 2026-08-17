import './src/libs/Env';
import type { NextConfig } from 'next';

// Define the base Next.js configuration
const baseConfig: NextConfig = {
  devIndicators: {
    position: 'bottom-right',
  },
  output: 'standalone',
  poweredByHeader: false,
  reactStrictMode: true,
  reactCompiler: process.env.NODE_ENV === 'production', // Keep the development environment fast
  logging: {
    browserToTerminal: process.env.BROWSER_TO_TERMINAL_DISABLED !== 'true',
  },
  experimental: {
    optimizePackageImports: ['lucide-react', '@clerk/localizations'],
  },
  outputFileTracingIncludes: {
    '/': ['./migrations/**/*'],
  },
};

const nextConfig = baseConfig;
export default nextConfig;
