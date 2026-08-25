const WEBSOCKET_CONNECT_DELAY_MS = 50;
const WEBSOCKET_DESTROY_DELAY_MS = 50;

type DocumentCollaborationWebsocket = {
  connect: () => Promise<unknown>;
  destroy: () => void;
};

/**
 * Starts a collaboration transport after the current React effect cycle.
 *
 * @param options - Transport factory and ready callback owned by the mounted collaboration editor.
 * @returns A cleanup function that cancels startup and defers destruction until child providers detach.
 */
export function startDocumentCollaborationWebsocket<
  Websocket extends DocumentCollaborationWebsocket,
>(options: { create: () => Websocket; onReady: (websocket: Websocket) => void }) {
  let websocket: Websocket | null = null;
  let connectTimeout: ReturnType<typeof setTimeout> | null = null;
  const createTimeout = setTimeout(() => {
    websocket = options.create();
    options.onReady(websocket);
    connectTimeout = setTimeout(() => {
      void websocket?.connect();
    }, WEBSOCKET_CONNECT_DELAY_MS);
  }, WEBSOCKET_CONNECT_DELAY_MS);

  return () => {
    clearTimeout(createTimeout);
    if (connectTimeout) {
      clearTimeout(connectTimeout);
    }
    setTimeout(() => {
      websocket?.destroy();
    }, WEBSOCKET_DESTROY_DELAY_MS);
  };
}
