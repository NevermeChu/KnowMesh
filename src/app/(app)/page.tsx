import type { Metadata } from 'next';
import { LandingCallToAction } from '@/components/landing/LandingCallToAction';
import { LandingEditorSearchSection } from '@/components/landing/LandingEditorSearchSection';
import { LandingFooter } from '@/components/landing/LandingFooter';
import { LandingHeader } from '@/components/landing/LandingHeader';
import { LandingHero } from '@/components/landing/LandingHero';
import { LandingKnowledgeMeshSection } from '@/components/landing/LandingKnowledgeMeshSection';
import { LandingTechnologySection } from '@/components/landing/LandingTechnologySection';
import { LandingWorkspaceModelSection } from '@/components/landing/LandingWorkspaceModelSection';
import { getCurrentUser } from '@/features/auth/server/CurrentUser';
import { AppConfig } from '@/utils/AppConfig';

export const metadata: Metadata = {
  title: `${AppConfig.name} - 让知识有序，让协作自然发生`,
  description:
    '基于双轨工作空间、细粒度能力权限、块级结构化 ProseMirror 与拓扑知识网格，为现代团队打造持久生长的知识大脑。',
};

export default async function HomePage() {
  const isAuthenticated = Boolean(await getCurrentUser());

  return (
    <div
      className="landing-root min-h-screen antialiased"
      style={{
        backgroundColor: 'var(--canvas)',
        color: 'var(--ink)',
        fontFamily:
          "'Plus Jakarta Sans', 'Noto Sans SC', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      <LandingHeader isAuthenticated={isAuthenticated} />
      <main>
        <LandingHero isAuthenticated={isAuthenticated} />
        <LandingKnowledgeMeshSection />
        <LandingWorkspaceModelSection />
        <LandingEditorSearchSection />
        <LandingTechnologySection />
        <LandingCallToAction isAuthenticated={isAuthenticated} />
      </main>
      <LandingFooter />
    </div>
  );
}
