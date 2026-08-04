import { SignOutButton } from '@clerk/nextjs';
import type { Metadata } from 'next';
import Link from 'next/link';
import { AppConfig } from '@/utils/AppConfig';

export const metadata: Metadata = {
  title: `${AppConfig.name} 工作台`,
  description: '管理团队知识空间与个人账户。',
};

export default function DashboardLayout(props: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#fbfbfa] text-[#2f3437] antialiased">
      <header className="border-b border-black/8 bg-white">
        <div className="mx-auto flex min-h-16 max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-3 sm:px-8">
          <Link href="/dashboard" className="flex items-center gap-3 font-semibold tracking-tight">
            <span
              aria-hidden="true"
              className="grid size-8 place-items-center rounded-lg bg-[#2f3437] text-sm font-bold text-white"
            >
              K
            </span>
            <span>{AppConfig.name}</span>
          </Link>

          <nav aria-label="工作台导航">
            <ul className="flex items-center gap-2 text-sm font-medium">
              <li>
                <Link
                  href="/dashboard"
                  className="rounded-lg px-3 py-2 transition-colors hover:bg-black/5"
                >
                  工作台
                </Link>
              </li>
              <li>
                <Link
                  href="/settings/user-profile"
                  className="rounded-lg px-3 py-2 transition-colors hover:bg-black/5"
                >
                  账户设置
                </Link>
              </li>
              <li>
                <SignOutButton>
                  <button
                    className="rounded-lg border border-black/12 bg-white px-3 py-2 transition-colors hover:bg-[#f2f1ee]"
                    type="button"
                  >
                    退出登录
                  </button>
                </SignOutButton>
              </li>
            </ul>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-12 sm:px-8 sm:py-16">{props.children}</main>

      <footer className="border-t border-black/8 px-5 py-8 text-center text-sm text-[#8a8d91] sm:px-8">
        © {new Date().getFullYear()} {AppConfig.name}. 让知识持续创造价值。
      </footer>
    </div>
  );
}
