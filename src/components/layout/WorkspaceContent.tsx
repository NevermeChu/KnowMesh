/**
 * Centers page content at the user's preferred reading width within the workspace
 * content area; mobile always renders full width.
 *
 * @param props - Element kind, page content, and optional layout classes such as vertical padding.
 * @returns The centered content container.
 */
export function WorkspaceContent(props: {
  as?: 'article' | 'div' | 'section';
  children: React.ReactNode;
  className?: string;
}) {
  const Container = props.as ?? 'div';

  return (
    <Container
      className={`mx-auto w-full sm:w-[var(--content-read-width)] ${props.className ?? ''}`}
    >
      {props.children}
    </Container>
  );
}
