import { describe, expect, it } from 'vitest';
import { EMPTY_WHITEBOARD_SCENE } from '../WhiteboardScene';
import {
  whiteboardCandidateSchema,
  whiteboardSaveAcknowledgementSchema,
} from './WhiteboardCollaborationProtocol';

describe('whiteboard collaboration protocol', () => {
  it('accepts a versioned full-scene candidate', () => {
    expect(
      whiteboardCandidateSchema.parse({
        clientMutationId: crypto.randomUUID(),
        expectedRevision: 1,
        scene: EMPTY_WHITEBOARD_SCENE,
      }),
    ).toMatchObject({ expectedRevision: 1, scene: EMPTY_WHITEBOARD_SCENE });
  });

  it('rejects invalid scenes before persistence', () => {
    expect(
      whiteboardCandidateSchema.safeParse({
        clientMutationId: crypto.randomUUID(),
        expectedRevision: 1,
        scene: { ...EMPTY_WHITEBOARD_SCENE, files: { forged: {} } },
      }).success,
    ).toBeFalsy();
  });

  it('rejects unrecognized save acknowledgements', () => {
    expect(
      whiteboardSaveAcknowledgementSchema.safeParse({
        clientMutationId: crypto.randomUUID(),
        status: 'saved',
      }).success,
    ).toBeFalsy();
  });
});
