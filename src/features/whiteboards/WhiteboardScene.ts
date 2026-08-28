import * as z from 'zod';
import type { JsonObject, JsonValue } from '@/features/documents/Document';

export const WHITEBOARD_SCENE_SCHEMA_VERSION = 1;

export const MAX_WHITEBOARD_ELEMENTS = 10_000;
export const MAX_WHITEBOARD_SCENE_BYTES = 5 * 1024 * 1024;

const MAX_SCENE_DEPTH = 100;
const MAX_SCENE_STRING_LENGTH = 512 * 1024;
const MAX_SCENE_COORDINATE = 10_000_000;

export type WhiteboardScene = {
  appState: {
    gridModeEnabled?: boolean;
    gridSize?: number | null;
    gridStep?: number;
    name?: string;
    viewBackgroundColor?: string;
  };
  elements: JsonObject[];
  files: Record<string, never>;
  source: 'knowmesh';
  type: 'excalidraw';
  version: typeof WHITEBOARD_SCENE_SCHEMA_VERSION;
};

const isJsonObject = (value: JsonValue): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isSafeSceneValue = (value: unknown, depth = 0): value is JsonValue => {
  if (depth > MAX_SCENE_DEPTH) {
    return false;
  }

  if (value === null || typeof value === 'boolean') {
    return true;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value);
  }

  if (typeof value === 'string') {
    return value.length <= MAX_SCENE_STRING_LENGTH && !value.startsWith('data:');
  }

  if (Array.isArray(value)) {
    return value.every((item) => isSafeSceneValue(item, depth + 1));
  }

  if (typeof value === 'object') {
    return Object.values(value).every((item) => isSafeSceneValue(item, depth + 1));
  }

  return false;
};

const elementSchema = z.custom<JsonObject>((value) => {
  if (!isSafeSceneValue(value) || !isJsonObject(value)) {
    return false;
  }

  const requiredStringFields = ['id', 'type'] as const;
  if (requiredStringFields.some((field) => typeof value[field] !== 'string')) {
    return false;
  }

  const requiredNumberFields = ['height', 'version', 'versionNonce', 'width', 'x', 'y'] as const;
  if (requiredNumberFields.some((field) => typeof value[field] !== 'number')) {
    return false;
  }

  const coordinateFields = ['height', 'width', 'x', 'y'] as const;
  if (
    coordinateFields.some((field) => {
      const coordinate = value[field];
      return typeof coordinate !== 'number' || Math.abs(coordinate) > MAX_SCENE_COORDINATE;
    })
  ) {
    return false;
  }

  return typeof value.isDeleted === 'boolean';
}, '白板元素格式无效');

const whiteboardSceneStructureSchema = z.object({
  appState: z
    .object({
      gridModeEnabled: z.boolean().optional(),
      gridSize: z.number().positive().nullable().optional(),
      gridStep: z.number().positive().optional(),
      name: z.string().max(200).optional(),
      viewBackgroundColor: z.string().max(64).optional(),
    })
    .strict(),
  elements: z.array(elementSchema).max(MAX_WHITEBOARD_ELEMENTS),
  files: z.record(z.string(), z.never()),
  source: z.literal('knowmesh'),
  type: z.literal('excalidraw'),
  version: z.literal(WHITEBOARD_SCENE_SCHEMA_VERSION),
});

export const whiteboardSceneSchema = whiteboardSceneStructureSchema.superRefine(
  (scene, context) => {
    if (new TextEncoder().encode(JSON.stringify(scene)).byteLength > MAX_WHITEBOARD_SCENE_BYTES) {
      context.addIssue({
        code: 'custom',
        message: '白板场景超过大小限制',
      });
    }
  },
);

export const EMPTY_WHITEBOARD_SCENE: WhiteboardScene = {
  appState: {},
  elements: [],
  files: {},
  source: 'knowmesh',
  type: 'excalidraw',
  version: WHITEBOARD_SCENE_SCHEMA_VERSION,
};
