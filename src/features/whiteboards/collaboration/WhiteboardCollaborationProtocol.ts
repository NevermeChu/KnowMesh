import * as z from 'zod';
import { whiteboardSceneSchema } from '../WhiteboardScene';
import type { WhiteboardScene } from '../WhiteboardScene';

export const WHITEBOARD_COLLABORATION_PATH = '/whiteboard-collaboration/socket.io';
export const MAX_WHITEBOARD_CONFLICT_RETRIES = 3;
export const MAX_WHITEBOARD_CURSOR_EVENTS_PER_WINDOW = 600;
export const MAX_WHITEBOARD_LIVE_SCENE_EVENTS_PER_WINDOW = 400;
export const MAX_WHITEBOARD_SAVE_EVENTS_PER_WINDOW = 20;
export const WHITEBOARD_REALTIME_INTERVAL_MS = 33;
export const WHITEBOARD_SAVE_DEBOUNCE_MS = 750;
export const WHITEBOARD_SAVE_RATE_WINDOW_MS = 10_000;

export const whiteboardCollaborationHandshakeSchema = z.object({
  documentId: z.uuid(),
});

export const whiteboardCandidateSchema = z.object({
  clientMutationId: z.uuid(),
  expectedRevision: z.number().int().positive(),
  scene: whiteboardSceneSchema,
});

export const whiteboardPointerSchema = z.object({
  button: z.enum(['down', 'up']),
  clientSequence: z.number().int().nonnegative(),
  tool: z.enum(['laser', 'pointer']),
  x: z.number().min(-10_000_000).max(10_000_000),
  y: z.number().min(-10_000_000).max(10_000_000),
});

export const whiteboardLiveSceneUpdateSchema = z.object({
  clientSequence: z.number().int().nonnegative(),
  scene: whiteboardSceneSchema,
});

const canonicalSceneSchema = z.object({
  revision: z.number().int().positive(),
  scene: whiteboardSceneSchema,
  updatedAt: z.iso.datetime(),
});

export const whiteboardSaveAcknowledgementSchema = z.union([
  canonicalSceneSchema.extend({ clientMutationId: z.uuid(), status: z.literal('conflict') }),
  canonicalSceneSchema.extend({ clientMutationId: z.uuid(), status: z.literal('saved') }),
  z.object({
    clientMutationId: z.uuid(),
    message: z.enum(['permission-denied', 'persistence-failed']),
    status: z.literal('error'),
  }),
  z.object({
    clientMutationId: z.uuid(),
    message: z.literal('rate-limited'),
    retryAfterMs: z.number().int().positive(),
    status: z.literal('error'),
  }),
]);

export type WhiteboardCollaborationMember = {
  connectionId: string;
  id: string;
  image: string | null;
  name: string;
};

export type WhiteboardCursorUpdate = z.infer<typeof whiteboardPointerSchema> & {
  connectionId: string;
};

export type WhiteboardLiveSceneUpdate = z.infer<typeof whiteboardLiveSceneUpdateSchema>;

export type WhiteboardRemoteSceneUpdate = WhiteboardLiveSceneUpdate & {
  connectionId: string;
};

export type WhiteboardCanonicalScene = {
  revision: number;
  scene: WhiteboardScene;
  updatedAt: string;
};

export type WhiteboardBaseline = WhiteboardCanonicalScene & {
  canWrite: boolean;
  members: WhiteboardCollaborationMember[];
};

export type WhiteboardSaveAcknowledgement = z.infer<typeof whiteboardSaveAcknowledgementSchema>;

export type WhiteboardClientToServerEvents = {
  cursor: (pointer: unknown) => void;
  save: (candidate: unknown, acknowledge: (result: WhiteboardSaveAcknowledgement) => void) => void;
  scene: (update: unknown) => void;
};

export type WhiteboardServerToClientEvents = {
  baseline: (baseline: WhiteboardBaseline) => void;
  canonical: (canonical: WhiteboardCanonicalScene) => void;
  cursor: (pointer: WhiteboardCursorUpdate) => void;
  frozen: (reason: 'permission-denied' | 'service-unavailable') => void;
  presence: (members: WhiteboardCollaborationMember[]) => void;
  scene: (update: WhiteboardRemoteSceneUpdate) => void;
};

export type WhiteboardSocketData = {
  accessValidatedAt: number;
  canWrite: boolean;
  documentId: string;
  image: string | null;
  name: string;
  projectId: string;
  sessionId: string;
  userId: string;
};
