import { ProjectDocumentsPage } from '@/features/documents/components/ProjectDocumentsPage';

export default function PersonalPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <ProjectDocumentsPage area="personal" searchParams={props.searchParams} />;
}
