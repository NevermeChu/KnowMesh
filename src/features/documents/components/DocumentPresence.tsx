'use client';

export type DocumentCollaborationMember = {
  clientId: number;
  color: string;
  id: string;
  name: string;
};

export function DocumentPresence(props: { members: DocumentCollaborationMember[] }) {
  if (props.members.length === 0) {
    return null;
  }

  const visibleMembers = props.members.slice(0, 4);
  const hiddenCount = props.members.length - visibleMembers.length;

  return (
    <div aria-label={`${props.members.length} 位成员在线`} className="flex items-center -space-x-1">
      {visibleMembers.map((member) => (
        <span
          key={`${member.clientId}:${member.id}`}
          className="grid size-6 place-items-center rounded-full border-2 border-canvas text-[10px] font-semibold text-white"
          style={{ backgroundColor: member.color }}
          title={member.name}
        >
          {member.name.trim().slice(0, 1).toLocaleUpperCase() || '?'}
        </span>
      ))}
      {hiddenCount > 0 && (
        <span className="grid size-6 place-items-center rounded-full border-2 border-canvas bg-surface text-[10px] font-semibold text-ink-muted">
          +{hiddenCount}
        </span>
      )}
    </div>
  );
}
