import type { LucideIcon } from 'lucide-react';
import { ArrowLeft, Bell, Layers, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { AppLogo } from '@/components/ui/AppLogo';
import { AppConfig } from '@/utils/AppConfig';

const capabilities: { icon: LucideIcon; title: string; description: string }[] = [
  {
    icon: Layers,
    title: '结构化沉淀',
    description: '工作区、项目与文档分层组织；Tiptap 富文本，失焦自动保存为结构化 JSON。',
  },
  {
    icon: ShieldCheck,
    title: '团队与最小授权',
    description: '团队工作区成员只见结构，项目直接成员才能读正文；邀请加入默认只读 viewer。',
  },
  {
    icon: Bell,
    title: '闭环通知',
    description: '邀请接受、权限申请与审批全程通知，未读数顶部可见。',
  },
];

/**
 * Wraps Clerk sign-in and sign-up pages in a branded split-screen shell.
 *
 * @param props - Layout children rendered in the authentication pane.
 * @returns The authentication layout.
 */
export default function AuthLayout(props: { children: React.ReactNode }) {
  return (
    <div className="grid h-dvh grid-rows-[auto_minmax(0,1fr)] overflow-hidden bg-[#fbfbfa] text-[#2f3437] antialiased lg:grid-cols-[0.45fr_0.55fr] lg:grid-rows-1">
      <section className="relative isolate flex min-w-0 flex-col overflow-hidden px-5 py-4 sm:px-8 lg:h-full lg:gap-8 lg:px-10 lg:py-8 xl:px-14 xl:py-10">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 bg-linear-to-br from-[#dbeeff] via-[#fbfbfa] to-[#f1e9dc] opacity-50 blur-2xl"
        />

        <div className="flex items-center gap-3 font-semibold tracking-tight text-[#202124]">
          <AppLogo className="size-8" />
          <span>{AppConfig.name}</span>
        </div>

        <div className="hidden min-h-0 flex-1 flex-col justify-center gap-5 lg:flex lg:max-w-xl">
          <p className="inline-flex w-fit items-center rounded-full border border-black/8 bg-white px-3 py-1 text-sm text-[#6b6f76] shadow-sm">
            面向团队的知识工作空间
          </p>
          <h1 className="text-3xl leading-[1.12] font-bold tracking-[-0.03em] text-[#202124] xl:text-4xl">
            让零散信息，
            <span className="block text-[#2383e2]">沉淀为团队共同知识。</span>
          </h1>
          <p className="max-w-lg text-base leading-7 text-[#777b80]">
            用工作区、项目和文档，把团队上下文汇聚在一处。清晰组织每一条知识，让重要信息在需要时自然浮现。
          </p>
          <ul className="flex flex-col gap-4">
            {capabilities.map((capability) => {
              const Icon = capability.icon;
              return (
                <li className="flex items-start gap-3.5" key={capability.title}>
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#e8f3fc] text-[#2383e2]">
                    <Icon className="size-5" strokeWidth={1.8} />
                  </span>
                  <div>
                    <p className="font-semibold text-[#2f3437]">{capability.title}</p>
                    <p className="mt-1 max-w-md text-sm leading-6 text-[#777b80]">
                      {capability.description}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="hidden lg:block">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-[#50545a] transition-colors hover:bg-black/5 hover:text-[#2f3437]"
          >
            <ArrowLeft className="size-4" strokeWidth={1.8} />
            返回首页
          </Link>
        </div>
      </section>

      <section className="flex min-h-0 min-w-0 items-center justify-center overflow-hidden border-t border-black/5 px-5 py-5 sm:px-8 lg:border-t-0 lg:border-l lg:px-10 lg:py-6">
        {props.children}
      </section>
    </div>
  );
}
