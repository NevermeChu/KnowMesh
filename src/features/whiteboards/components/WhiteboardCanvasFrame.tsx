/**
 * Fills the workspace document pane so Excalidraw is not constrained by reading width.
 *
 * Overlay islands match Excalidraw desktop chrome: `--editor-container-padding` 1rem,
 * `--lg-button-size` 2.25rem (2.5rem above 1921px), and 0.75rem gap beside the menu.
 *
 * @param props - Canvas, optional banner, and overlay islands for document actions.
 * @returns The full-bleed whiteboard chrome.
 */
export function WhiteboardCanvasFrame(props: {
  banner?: React.ReactNode;
  canvas: React.ReactNode;
  documentActions: React.ReactNode;
  nestBesideExcalidrawMenu?: boolean;
  status?: React.ReactNode;
}) {
  const documentActionsPosition = props.nestBesideExcalidrawMenu
    ? 'top-4 left-16 h-9 min-[1921px]:left-[4.25rem] min-[1921px]:h-10 max-[730px]:left-4'
    : 'top-4 left-4 h-9 min-[1921px]:h-10';
  const statusPosition = props.nestBesideExcalidrawMenu
    ? 'top-4 right-16 h-9 min-[1921px]:right-[4.25rem] min-[1921px]:h-10 max-[730px]:right-4'
    : 'top-4 right-4 h-9 min-[1921px]:h-10';

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-card">
      {props.banner}
      <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
        {props.canvas}
        <div className="pointer-events-none absolute inset-0 z-10">
          <div
            className={`pointer-events-auto absolute box-border flex items-center gap-1 rounded-lg border border-line bg-card/95 px-1 shadow-card ${documentActionsPosition}`}
          >
            {props.documentActions}
          </div>
          {props.status ? (
            <div
              className={`pointer-events-auto absolute box-border flex items-center gap-2 rounded-lg border border-line bg-card/95 px-2 shadow-card ${statusPosition}`}
            >
              {props.status}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
