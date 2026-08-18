import { Avatar } from '@/components/ui/Avatar';
import type { PermissionOverview } from '@/features/projects/PermissionOverview';
import { memberRoleOrder, sectionTitleClassName } from './helpers';
import { PermissionMemberRole } from './PermissionMemberRole';

/**
 * Renders the member groups list and user rows.
 *
 * @param props - Overview state and mutation callback.
 * @returns The member group sections.
 */
export function PermissionGroupList(props: {
  onMutated: (operation: 'delete' | 'update', scope: PermissionOverview['scope']) => void;
  overview: PermissionOverview;
}) {
  if (props.overview.groups.length === 0) {
    return <p className="py-10 text-center text-sm text-ink-faint">暂无成员权限</p>;
  }

  return (
    <>
      {props.overview.groups.map((group) => {
        const members = [...group.members].toSorted(
          (left, right) => memberRoleOrder[left.role] - memberRoleOrder[right.role],
        );

        return (
          <section className="mb-6 last:mb-0" key={group.id}>
            {(props.overview.scope === 'workspace' || props.overview.groups.length > 1) && (
              <h3 className={`mb-2 ${sectionTitleClassName}`}>{group.name}</h3>
            )}
            {members.length === 0 ? (
              <p className="rounded-lg bg-overlay px-3 py-2.5 text-xs text-ink-faint">暂无成员</p>
            ) : (
              <ul className="space-y-1.5">
                {members.map((member) => (
                  <li
                    className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 ${
                      member.isCurrentUser
                        ? 'border-accent/30 bg-accent-soft'
                        : 'border-transparent bg-overlay'
                    }`}
                    key={member.userId}
                  >
                    <Avatar name={member.displayName} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-ink">
                          {member.displayName}
                        </span>
                        {member.isCurrentUser && (
                          <span className="shrink-0 rounded-full bg-accent px-1.5 py-0.5 text-[0.625rem] font-semibold text-white">
                            你
                          </span>
                        )}
                      </span>
                      {member.email && member.email !== member.displayName && (
                        <span className="block truncate text-xs text-ink-faint">
                          {member.email}
                        </span>
                      )}
                    </span>
                    <PermissionMemberRole
                      groupSource={group.source}
                      member={member}
                      onMutated={props.onMutated}
                      overview={props.overview}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </>
  );
}
