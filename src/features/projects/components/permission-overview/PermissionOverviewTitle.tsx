import type {
  PermissionOverview,
  PermissionOverviewInput,
} from '@/features/projects/PermissionOverview';

function PermissionDocumentTitle(props: {
  overview: Extract<PermissionOverview, { scope: 'document' }>;
  onNavigate: (input: PermissionOverviewInput) => void;
}) {
  return (
    <button
      className="truncate rounded-sm transition-colors hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      onClick={() => {
        props.onNavigate({ documentId: props.overview.document.id, scope: 'document' });
      }}
      type="button"
    >
      {props.overview.document.title}
    </button>
  );
}

function PermissionProjectTitle(props: {
  overview: Extract<PermissionOverview, { scope: 'document' | 'project' }>;
  onNavigate: (input: PermissionOverviewInput) => void;
}) {
  return (
    <button
      className="truncate rounded-sm transition-colors hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      onClick={() => {
        props.onNavigate({ projectId: props.overview.project.id, scope: 'project' });
      }}
      type="button"
    >
      {props.overview.project.name}
    </button>
  );
}

/**
 * Renders the breadcrumb navigation title for the permission overview dialog.
 *
 * @param props - Overview state and navigation callback.
 * @returns The title element or string.
 */
export function PermissionOverviewTitle(props: {
  onNavigate: (input: PermissionOverviewInput) => void;
  overview: PermissionOverview | null;
}) {
  if (!props.overview) {
    return '权限列表';
  }

  if (props.overview.scope === 'workspace') {
    return props.overview.title;
  }

  if (props.overview.scope === 'project') {
    return <PermissionProjectTitle onNavigate={props.onNavigate} overview={props.overview} />;
  }

  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <PermissionProjectTitle onNavigate={props.onNavigate} overview={props.overview} />
      <span aria-hidden="true" className="shrink-0 text-ink-faint">
        \
      </span>
      <PermissionDocumentTitle onNavigate={props.onNavigate} overview={props.overview} />
    </span>
  );
}
