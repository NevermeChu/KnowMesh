import { Show, SignOutButton } from '@clerk/nextjs';
import type { Metadata } from 'next';
import Link from 'next/link';
import { AppLogo } from '@/components/ui/AppLogo';
import { AppConfig } from '@/utils/AppConfig';

export const metadata: Metadata = {
  title: `${AppConfig.name} - 让知识有序，让协作发生`,
  description: '将团队知识、项目资料和协作上下文汇聚在一处，构建清晰、持续生长的知识网络。',
};

export default function HomePage() {
  return (
    <div className="min-h-screen bg-canvas text-ink antialiased">
      <header className="border-b border-line bg-canvas/90 backdrop-blur">
        <nav
          aria-label="首页导航"
          className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8"
        >
          <Link href="/" className="flex items-center gap-3 font-semibold tracking-tight">
            <AppLogo className="size-8" />
            <span>{AppConfig.name}</span>
          </Link>

          <div className="flex items-center gap-2 text-sm font-medium">
            <Show when="signed-out">
              <Link
                href="/sign-in"
                className="rounded-lg px-4 py-2 text-ink-secondary transition-colors hover:bg-overlay hover:text-ink"
              >
                登录
              </Link>
            </Show>

            <Show when="signed-in">
              <Link
                href="/dashboard"
                className="rounded-lg px-4 py-2 text-ink-secondary transition-colors hover:bg-overlay hover:text-ink"
              >
                进入工作台
              </Link>
              <SignOutButton>
                <button
                  type="button"
                  className="rounded-lg border border-line bg-card px-4 py-2 text-ink-secondary shadow-card transition-colors hover:bg-surface hover:text-ink"
                >
                  退出登录
                </button>
              </SignOutButton>
            </Show>
          </div>
        </nav>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-14 px-5 pt-20 pb-16 sm:px-8 sm:pt-28 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20 lg:pb-24">
          <div className="max-w-xl">
            <p className="mb-5 inline-flex items-center rounded-full border border-line bg-card px-3 py-1 text-sm text-ink-muted shadow-card">
              为团队打造的知识工作空间
            </p>
            <h1 className="text-5xl leading-[1.08] font-bold tracking-[-0.045em] text-ink sm:text-6xl">
              让知识有序，
              <span className="block text-accent">让协作发生。</span>
            </h1>
            <p className="mt-7 max-w-lg text-lg leading-8 text-ink-muted">
              将文档、想法和团队上下文汇聚在一处。清晰组织每一条知识，让重要信息在需要时自然浮现。
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Show when="signed-out">
                <Link
                  href="/sign-in"
                  className="rounded-lg bg-accent px-5 py-3 text-sm font-semibold text-white shadow-card transition-colors hover:bg-accent-strong"
                >
                  开始使用
                </Link>
              </Show>
              <Show when="signed-in">
                <Link
                  href="/dashboard"
                  className="rounded-lg bg-accent px-5 py-3 text-sm font-semibold text-white shadow-card transition-colors hover:bg-accent-strong"
                >
                  进入工作台
                </Link>
              </Show>
              <a
                href="#features"
                className="rounded-lg px-5 py-3 text-sm font-semibold text-ink-secondary transition-colors hover:bg-overlay"
              >
                了解更多
              </a>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-5 -z-10 rounded-[2rem] bg-linear-to-br from-accent-soft via-card to-warning-soft blur-2xl" />
            <div className="overflow-hidden rounded-xl border border-line bg-card shadow-overlay">
              <div className="flex h-11 items-center gap-2 border-b border-line bg-surface px-4">
                <span className="size-2.5 rounded-full bg-[#ff6b6b]" />
                <span className="size-2.5 rounded-full bg-[#ffd43b]" />
                <span className="size-2.5 rounded-full bg-[#69db7c]" />
                <span className="ml-3 text-xs text-ink-faint">KnowMesh / 产品空间</span>
              </div>

              <div className="grid min-h-96 grid-cols-[8.5rem_1fr] sm:grid-cols-[11rem_1fr]">
                <aside className="border-r border-line bg-surface p-4 text-xs text-ink-muted">
                  <p className="mb-4 font-semibold text-ink">产品团队</p>
                  <ul className="space-y-1.5">
                    <li className="rounded-md bg-overlay px-2 py-1.5 font-medium text-ink">
                      团队主页
                    </li>
                    <li className="px-2 py-1.5">产品知识库</li>
                    <li className="px-2 py-1.5">项目进展</li>
                    <li className="px-2 py-1.5">会议记录</li>
                  </ul>
                  <p className="mt-7 mb-2 px-2 text-[0.65rem] font-semibold tracking-wider text-ink-faint uppercase">
                    收藏
                  </p>
                  <ul className="space-y-1.5">
                    <li className="px-2 py-1.5">设计规范</li>
                    <li className="px-2 py-1.5">季度目标</li>
                  </ul>
                </aside>

                <div className="p-6 sm:p-9">
                  <div className="mb-7 text-4xl">👋</div>
                  <h2 className="text-2xl font-bold tracking-tight text-ink">产品团队空间</h2>
                  <p className="mt-3 max-w-md text-sm leading-6 text-ink-muted">
                    欢迎来到团队知识中心。所有决策、文档和项目背景都在这里持续沉淀。
                  </p>

                  <div className="mt-8 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-line p-4">
                      <p className="text-sm font-semibold">产品知识库</p>
                      <p className="mt-2 text-xs leading-5 text-ink-faint">12 个专题 · 今天更新</p>
                    </div>
                    <div className="rounded-xl border border-line p-4">
                      <p className="text-sm font-semibold">本周项目进展</p>
                      <p className="mt-2 text-xs leading-5 text-ink-faint">8 位成员正在协作</p>
                    </div>
                  </div>

                  <div className="mt-6 space-y-3">
                    <div className="h-2.5 w-full rounded-full bg-surface-strong" />
                    <div className="h-2.5 w-5/6 rounded-full bg-surface-strong" />
                    <div className="h-2.5 w-3/5 rounded-full bg-surface-strong" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="border-y border-line bg-card">
          <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-24">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold text-accent">一个空间，持续生长</p>
              <h2 className="mt-3 text-3xl font-bold tracking-[-0.03em] text-ink sm:text-4xl">
                从零散信息，到团队共同知识
              </h2>
            </div>

            <div className="mt-12 grid gap-4 md:grid-cols-3">
              <article className="rounded-xl border border-line bg-canvas p-6">
                <span className="grid size-10 place-items-center rounded-xl bg-accent-soft text-lg">
                  ✦
                </span>
                <h3 className="mt-5 font-semibold text-ink">清晰沉淀</h3>
                <p className="mt-3 text-sm leading-6 text-ink-muted">
                  用统一的结构保存文档、决策和经验，让知识不再散落在聊天记录里。
                </p>
              </article>

              <article className="rounded-xl border border-line bg-canvas p-6">
                <span className="grid size-10 place-items-center rounded-xl bg-[#f1edfc] text-lg">
                  ⌘
                </span>
                <h3 className="mt-5 font-semibold text-ink">自然关联</h3>
                <p className="mt-3 text-sm leading-6 text-ink-muted">
                  连接项目、人物与主题，在上下文中理解信息，而不只是查找孤立页面。
                </p>
              </article>

              <article className="rounded-xl border border-line bg-canvas p-6">
                <span className="grid size-10 place-items-center rounded-xl bg-[#eaf5ee] text-lg">
                  ◎
                </span>
                <h3 className="mt-5 font-semibold text-ink">共同协作</h3>
                <p className="mt-3 text-sm leading-6 text-ink-muted">
                  围绕同一份内容讨论、更新和推进，让知识与实际工作始终保持同步。
                </p>
              </article>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-4xl px-5 py-20 text-center sm:px-8 sm:py-28">
          <h2 className="text-3xl font-bold tracking-[-0.03em] text-ink sm:text-4xl">
            从今天开始，建立团队的共同记忆
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-ink-muted">
            让每一次讨论都有沉淀，让每一份知识都能被再次发现。
          </p>
          <Show when="signed-out">
            <Link
              href="/sign-in"
              className="mt-8 inline-flex rounded-lg bg-ink px-5 py-3 text-sm font-semibold text-canvas transition-colors hover:bg-ink-secondary"
            >
              登录 KnowMesh
            </Link>
          </Show>
          <Show when="signed-in">
            <Link
              href="/dashboard"
              className="mt-8 inline-flex rounded-lg bg-ink px-5 py-3 text-sm font-semibold text-canvas transition-colors hover:bg-ink-secondary"
            >
              返回工作台
            </Link>
          </Show>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-8 text-sm text-ink-faint sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <div className="flex items-center gap-2">
            <AppLogo className="size-6" />
            <span>{AppConfig.name}</span>
          </div>
          <p>© {new Date().getFullYear()} KnowMesh. 让知识持续创造价值。</p>
        </div>
      </footer>
    </div>
  );
}
