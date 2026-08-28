import { describe, expect, it, vi } from 'vitest';
import { EMPTY_WHITEBOARD_SCENE } from '../WhiteboardScene';
import type { WhiteboardScene } from '../WhiteboardScene';
import { TeamWhiteboardSaveQueue } from './TeamWhiteboardSaveQueue';
import type { WhiteboardSaveAcknowledgement } from './WhiteboardCollaborationProtocol';

type SaveCandidate = {
  clientMutationId: string;
  expectedRevision: number;
  scene: WhiteboardScene;
};

const createApplyMock = () => vi.fn<(scene: WhiteboardScene) => void>();
const createFrozenMock = () =>
  vi.fn<(reason: 'permission-denied' | 'service-unavailable') => void>();
const createStateMock = () => vi.fn<(state: 'conflict' | 'error' | 'saved' | 'saving') => void>();

const createScene = (id: string, version = 1): WhiteboardScene => ({
  ...EMPTY_WHITEBOARD_SCENE,
  elements: [
    {
      height: 80,
      id,
      isDeleted: false,
      type: 'rectangle',
      version,
      versionNonce: version * 100,
      width: 120,
      x: 20,
      y: 30,
    },
  ],
});

const canonical = (options: {
  revision: number;
  scene: WhiteboardScene;
  status: 'conflict' | 'saved';
}): WhiteboardSaveAcknowledgement => ({
  ...options,
  clientMutationId: crypto.randomUUID(),
  updatedAt: new Date().toISOString(),
});

describe(TeamWhiteboardSaveQueue, () => {
  it('reconciles conflict and retries with the canonical revision', async () => {
    const local = createScene('local');
    const remote = createScene('remote');
    const merged = { ...EMPTY_WHITEBOARD_SCENE, elements: [...local.elements, ...remote.elements] };
    const save = vi
      .fn<(options: SaveCandidate) => Promise<WhiteboardSaveAcknowledgement>>()
      .mockResolvedValueOnce(canonical({ revision: 2, scene: remote, status: 'conflict' }))
      .mockResolvedValueOnce(canonical({ revision: 3, scene: merged, status: 'saved' }));
    const queue = new TeamWhiteboardSaveQueue({
      apply: createApplyMock(),
      initialRevision: 1,
      initialScene: EMPTY_WHITEBOARD_SCENE,
      onFrozen: createFrozenMock(),
      onStateChange: createStateMock(),
      reconcile: vi
        .fn<(local: WhiteboardScene, remote: WhiteboardScene) => Promise<WhiteboardScene>>()
        .mockResolvedValue(merged),
      save,
    });

    queue.enqueue(local);
    await queue.flush();

    expect(save).toHaveBeenCalledTimes(2);
    expect(save.mock.calls[1]?.[0]).toMatchObject({ expectedRevision: 2, scene: merged });
    expect(queue.getLatestScene()).toStrictEqual(merged);
  });

  it('merges remote canonical scene with unsaved local changes', async () => {
    const local = createScene('local');
    const remote = createScene('remote');
    const merged = { ...EMPTY_WHITEBOARD_SCENE, elements: [...local.elements, ...remote.elements] };
    const save = vi
      .fn<(options: SaveCandidate) => Promise<WhiteboardSaveAcknowledgement>>()
      .mockImplementation( async (options) =>
        Promise.resolve(canonical({ revision: 3, scene: options.scene, status: 'saved' })),
      );
    const apply = createApplyMock();
    const queue = new TeamWhiteboardSaveQueue({
      apply,
      initialRevision: 1,
      initialScene: EMPTY_WHITEBOARD_SCENE,
      onFrozen: createFrozenMock(),
      onStateChange: createStateMock(),
      reconcile: vi
        .fn<(local: WhiteboardScene, remote: WhiteboardScene) => Promise<WhiteboardScene>>()
        .mockResolvedValue(merged),
      save,
    });

    queue.enqueue(local);
    await queue.receiveCanonical({
      revision: 2,
      scene: remote,
      updatedAt: new Date().toISOString(),
    });

    expect(apply).toHaveBeenCalledWith(merged);
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ expectedRevision: 2, scene: merged }),
    );
  });

  it('freezes after bounded conflict retries', async () => {
    const onFrozen = createFrozenMock();
    const scene = createScene('local');
    let revision = 1;
    const queue = new TeamWhiteboardSaveQueue({
      apply: createApplyMock(),
      initialRevision: revision,
      initialScene: EMPTY_WHITEBOARD_SCENE,
      onFrozen,
      onStateChange: createStateMock(),
      reconcile: vi
        .fn<(local: WhiteboardScene, remote: WhiteboardScene) => Promise<WhiteboardScene>>()
        .mockResolvedValue(scene),
      save: vi
        .fn<(options: SaveCandidate) => Promise<WhiteboardSaveAcknowledgement>>()
        .mockImplementation( async () => {
          revision += 1;
          return Promise.resolve(
            canonical({ revision, scene: EMPTY_WHITEBOARD_SCENE, status: 'conflict' }),
          );
        }),
    });

    queue.enqueue(scene);
    await queue.flush();

    expect(onFrozen).toHaveBeenCalledWith('service-unavailable');
  });
});
