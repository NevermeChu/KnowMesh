import { defineConfig } from 'oxfmt';
import ultracite from 'ultracite/oxfmt';

export default defineConfig({
  extends: [ultracite],
  endOfLine: process.platform === 'win32' ? 'crlf' : 'lf',
  singleQuote: true,
  ignorePatterns: ['.claude/**', '.clerk/**', 'migrations/*', '*.md'],
  sortImports: {
    ignoreCase: true,
    newlinesBetween: false,
    order: 'asc',
  },
  sortTailwindcss: {
    stylesheet: 'src/styles/global.css',
  },
});
