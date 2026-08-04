import Link from 'next/link';

export default function DashboardPage() {
  return (
    <div className="py-12 sm:py-16">
      <div className="max-w-2xl">
        <p className="text-sm font-semibold text-[#2383e2]">团队工作台</p>
        <h1 className="mt-3 text-4xl font-bold tracking-[-0.04em] text-[#202124]">
          欢迎回到知识空间
        </h1>
        <p className="mt-5 text-lg leading-8 text-[#666a70]">
          从这里整理团队资料、连接项目上下文，并让重要信息持续沉淀。
        </p>
      </div>

      <section aria-labelledby="workspace-heading" className="mt-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 id="workspace-heading" className="text-2xl font-semibold text-[#202124]">
              开始构建团队知识空间
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#777b80]">
              当前工作台已经就绪，可以从团队知识、项目背景和协作记录开始组织内容。
            </p>
          </div>
          <Link
            href="/settings/user-profile"
            className="rounded-lg border border-black/12 bg-white px-4 py-2 text-sm font-semibold shadow-sm transition-colors hover:bg-[#f2f1ee]"
          >
            管理账户
          </Link>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <article className="rounded-2xl border border-black/8 bg-white p-6 shadow-sm">
            <h3 className="font-semibold text-[#2f3437]">团队知识</h3>
            <p className="mt-3 text-sm leading-6 text-[#777b80]">
              集中整理文档、决策与经验，为团队保留可持续使用的共同记忆。
            </p>
          </article>
          <article className="rounded-2xl border border-black/8 bg-white p-6 shadow-sm">
            <h3 className="font-semibold text-[#2f3437]">项目上下文</h3>
            <p className="mt-3 text-sm leading-6 text-[#777b80]">
              汇聚目标、进展与背景信息，让项目资料保持清晰并相互关联。
            </p>
          </article>
          <article className="rounded-2xl border border-black/8 bg-white p-6 shadow-sm">
            <h3 className="font-semibold text-[#2f3437]">协作记录</h3>
            <p className="mt-3 text-sm leading-6 text-[#777b80]">
              沉淀讨论结果和后续行动，帮助成员快速理解已经发生的工作。
            </p>
          </article>
        </div>
      </section>
    </div>
  );
}
