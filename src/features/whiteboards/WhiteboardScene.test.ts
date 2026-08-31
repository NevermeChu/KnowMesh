import { describe, expect, it } from 'vitest';
import {
  createWhiteboardScene,
  EMPTY_WHITEBOARD_SCENE,
  getWhiteboardSceneVersionFingerprint,
  WhiteboardRemoteSceneEchoGuard,
  whiteboardSceneSchema,
} from './WhiteboardScene';

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

  it('removes unsupported image elements and links before persistence', () => {
    expect(
      createWhiteboardScene({
        appState: { name: null, viewBackgroundColor: '#ffffff' },
        elements: [
          { ...rectangle, boundElements: undefined, link: 'https://example.com' },
          { ...rectangle, id: 'image-1', type: 'image' },
        ],
      }),
    ).toMatchObject({
      appState: { viewBackgroundColor: '#ffffff' },
      elements: [rectangle],
      files: {},
    });
  });

  it('ignores restore-only fields in version fingerprints', () => {
    const canonical = { ...EMPTY_WHITEBOARD_SCENE, elements: [rectangle] };
    const restored = {
      ...EMPTY_WHITEBOARD_SCENE,
      elements: [{ ...rectangle, angle: 0, seed: 1234 }],
    };

    expect(getWhiteboardSceneVersionFingerprint(restored)).toBe(
      getWhiteboardSceneVersionFingerprint(canonical),
    );
  });

  it('detects edited element versions in fingerprints', () => {
    const canonical = { ...EMPTY_WHITEBOARD_SCENE, elements: [rectangle] };
    const edited = {
      ...EMPTY_WHITEBOARD_SCENE,
      elements: [{ ...rectangle, version: 2 }],
    };

    expect(getWhiteboardSceneVersionFingerprint(edited)).not.toBe(
      getWhiteboardSceneVersionFingerprint(canonical),
    );
  });

  it('detects persisted app state changes in fingerprints', () => {
    const canonical = { ...EMPTY_WHITEBOARD_SCENE, elements: [rectangle] };
    const edited = {
      ...canonical,
      appState: { viewBackgroundColor: '#f8fafc' },
    };

    expect(getWhiteboardSceneVersionFingerprint(edited)).not.toBe(
      getWhiteboardSceneVersionFingerprint(canonical),
    );
  });

  it('ignores every matching remote callback until the scene changes', () => {
    const guard = new WhiteboardRemoteSceneEchoGuard();
    const canonical = { ...EMPTY_WHITEBOARD_SCENE, elements: [rectangle] };
    const edited = {
      ...EMPTY_WHITEBOARD_SCENE,
      elements: [{ ...rectangle, version: 2 }],
    };
    guard.mark(canonical);

    expect(guard.shouldIgnore(canonical)).toBeTruthy();
    expect(guard.shouldIgnore(canonical)).toBeTruthy();
    expect(guard.shouldIgnore(edited)).toBeFalsy();
    expect(guard.shouldIgnore(canonical)).toBeFalsy();
  });
});
