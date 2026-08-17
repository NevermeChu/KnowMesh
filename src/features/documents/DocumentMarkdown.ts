import type { DocumentContent, DocumentMark, DocumentNode } from './Document';

function formatInlineText(text: string, marks?: DocumentMark[]): string {
  if (!marks || marks.length === 0 || !text) {
    return text;
  }

  let formatted = text;

  for (const mark of marks) {
    switch (mark.type) {
      case 'bold': {
        formatted = `**${formatted}**`;
        break;
      }
      case 'italic': {
        formatted = `*${formatted}*`;
        break;
      }
      case 'strike': {
        formatted = `~~${formatted}~~`;
        break;
      }
      case 'code': {
        formatted = `\`${formatted}\``;
        break;
      }
      case 'link': {
        const href = typeof mark.attrs?.href === 'string' ? mark.attrs.href : '';
        formatted = `[${formatted}](${href})`;
        break;
      }
      default: {
        break;
      }
    }
  }

  return formatted;
}

function serializeCallout(node: DocumentNode, childContent: string): string {
  const type = typeof node.attrs?.type === 'string' ? node.attrs.type.toUpperCase() : 'NOTE';
  const calloutTypeMap: Record<string, string> = {
    INFO: 'NOTE',
    NOTE: 'NOTE',
    SUCCESS: 'TIP',
    WARNING: 'WARNING',
  };
  const alertTag = calloutTypeMap[type] ?? 'NOTE';
  const lines = childContent.trim().split('\n');
  const formattedLines = [`> [!${alertTag}]`, ...lines.map((line) => `> ${line}`)];
  return `${formattedLines.join('\n')}\n\n`;
}

type NodeSerializer = (
  node: DocumentNode,
  childContent: string,
  serializeChild: (child: DocumentNode) => string,
) => string;

const nodeSerializers: Record<string, NodeSerializer> = {
  blockquote: (_node, childContent) => {
    const quoted = childContent
      .trim()
      .split('\n')
      .map((line) => `> ${line}`)
      .join('\n');
    return `${quoted}\n\n`;
  },
  bulletList: (node, _childContent, serialize) => {
    const items = (node.content ?? []).map((child) => `- ${serialize(child).trim()}`).join('\n');
    return `${items}\n\n`;
  },
  callout: (node, childContent) => serializeCallout(node, childContent),
  codeBlock: (node, childContent) => {
    const language = typeof node.attrs?.language === 'string' ? node.attrs.language : '';
    return `\`\`\`${language}\n${childContent.trim()}\n\`\`\`\n\n`;
  },
  details: (_node, childContent) => `<details>\n${childContent.trim()}\n</details>\n\n`,
  detailsContent: (_node, childContent) => `${childContent.trim()}\n`,
  detailsSummary: (_node, childContent) => `<summary>${childContent.trim()}</summary>\n`,
  heading: (node, childContent) => {
    const level = typeof node.attrs?.level === 'number' ? node.attrs.level : 1;
    const hashes = '#'.repeat(Math.min(6, Math.max(1, level)));
    return `${hashes} ${childContent}\n\n`;
  },
  horizontalRule: () => '---\n\n',
  listItem: (_node, childContent) => childContent.trim(),
  orderedList: (node, _childContent, serialize) => {
    const items = (node.content ?? [])
      .map((child, idx) => `${idx + 1}. ${serialize(child).trim()}`)
      .join('\n');
    return `${items}\n\n`;
  },
  paragraph: (_node, childContent) => `${childContent}\n\n`,
  taskItem: (_node, childContent) => childContent.trim(),
  taskList: (node, _childContent, serialize) => {
    const items = (node.content ?? [])
      .map((child) => {
        const isChecked = Boolean(child.attrs?.checked);
        const checkbox = isChecked ? '- [x] ' : '- [ ] ';
        return `${checkbox}${serialize(child).trim()}`;
      })
      .join('\n');
    return `${items}\n\n`;
  },
};

function serializeNode(node: DocumentNode): string {
  if (node.type === 'text') {
    return formatInlineText(node.text ?? '', node.marks);
  }

  const childContent = (node.content ?? []).map(serializeNode).join('');
  const serializer = nodeSerializers[node.type];

  if (serializer) {
    return serializer(node, childContent, serializeNode);
  }

  return childContent;
}

/**
 * Converts ProseMirror document JSON structure into standard GitHub Flavored Markdown.
 *
 * @param content - Document ProseMirror JSON structure.
 * @param title - Optional document title to prepend as H1 heading.
 * @returns Clean, formatted Markdown string.
 */
export function proseMirrorToMarkdown(
  content: DocumentContent | null | undefined,
  title?: string,
): string {
  const chunks: string[] = [];

  if (title?.trim()) {
    chunks.push(`# ${title.trim()}\n\n`);
  }

  if (content && Array.isArray(content.content)) {
    for (const node of content.content) {
      chunks.push(serializeNode(node));
    }
  }

  return `${chunks.join('').trim()}\n`;
}
