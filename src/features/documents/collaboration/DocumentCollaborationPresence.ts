const collaborationColors = [
  '#2563eb',
  '#7c3aed',
  '#db2777',
  '#dc2626',
  '#ea580c',
  '#059669',
  '#0891b2',
] as const;

export function getDocumentCollaborationColor(userId: string) {
  let hash = 0;
  for (const character of userId) {
    hash = (hash * 31 + (character.codePointAt(0) ?? 0)) % 2_147_483_647;
  }
  return collaborationColors[hash % collaborationColors.length] ?? collaborationColors[0];
}
