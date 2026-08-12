import { ProjectDocumentsPage } from '@/features/documents/components/ProjectDocumentsPage';

export default function CollaborationPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <ProjectDocumentsPage area="collaboration" searchParams={props.searchParams} />;
}
