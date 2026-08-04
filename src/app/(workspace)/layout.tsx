import type { Metadata } from 'next';
import { AppShell } from '@/components/layout/AppShell';
import { AppConfig } from '@/utils/AppConfig';

export const metadata: Metadata = {
  title: `${AppConfig.name} 工作台`,
  description: '管理团队知识空间与个人账户。',
};

export default function WorkspaceLayout(props: { children: React.ReactNode }) {
  return <AppShell>{props.children}</AppShell>;
}
