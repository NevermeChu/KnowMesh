import { describe, expect, it } from 'vitest';
import { EMPTY_WHITEBOARD_SCENE, whiteboardSceneSchema } from './WhiteboardScene';

const rectangle = {
  height: 80,
  id: 'rectangle-1',
  isDeleted: false,
  type: 'rectangle',
  version: 1,
  versionNonce: 123,
  width: 120,
  x: 20,
  y: 30,
};

describe('whiteboard scene validation', () => {
  it('accepts empty scene', () => {
    expect(whiteboardSceneSchema.parse(EMPTY_WHITEBOARD_SCENE)).toStrictEqual(
      EMPTY_WHITEBOARD_SCENE,
    );
  });

  it('preserves compatible element fields', () => {
    const scene = {
      ...EMPTY_WHITEBOARD_SCENE,
      elements: [{ ...rectangle, customData: { owner: 'knowmesh' } }],
    };

    expect(whiteboardSceneSchema.parse(scene)).toStrictEqual(scene);
  });

  it('rejects binary data urls', () => {
    expect(
      whiteboardSceneSchema.safeParse({
        ...EMPTY_WHITEBOARD_SCENE,
        elements: [{ ...rectangle, link: 'data:image/png;base64,AAAA' }],
      }).success,
    ).toBeFalsy();
  });

  it('rejects persisted files', () => {
    expect(
      whiteboardSceneSchema.safeParse({
        ...EMPTY_WHITEBOARD_SCENE,
        files: { file1: { mimeType: 'image/png' } },
      }).success,
    ).toBeFalsy();
  });

  it('rejects transient app state', () => {
    expect(
      whiteboardSceneSchema.safeParse({
        ...EMPTY_WHITEBOARD_SCENE,
        appState: { selectedElementIds: { 'rectangle-1': true } },
      }).success,
    ).toBeFalsy();
  });
});
