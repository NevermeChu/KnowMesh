import { FileText, Shapes } from 'lucide-react';
import type { DocumentKind } from '../Document';

export function DocumentKindIcon(props: {
  className?: string;
  kind: DocumentKind;
  strokeWidth?: number;
}) {
  const Icon = props.kind === 'whiteboard' ? Shapes : FileText;
  return (
    <Icon aria-hidden="true" className={props.className} strokeWidth={props.strokeWidth ?? 1.8} />
  );
}
