import { describe, expect, it } from 'vitest';
import { EMPTY_WHITEBOARD_SCENE } from '../WhiteboardScene';
import {
  whiteboardCandidateSchema,
  whiteboardSaveAcknowledgementSchema,
} from './WhiteboardCollaborationProtocol';

describe('whiteboard collaboration protocol', () => {
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

  it('accepts rate-limit backpressure with a retry delay', () => {
    expect(
      whiteboardSaveAcknowledgementSchema.safeParse({
        clientMutationId: crypto.randomUUID(),
        message: 'rate-limited',
        retryAfterMs: 1000,
        status: 'error',
      }).success,
    ).toBeTruthy();
  });
});
