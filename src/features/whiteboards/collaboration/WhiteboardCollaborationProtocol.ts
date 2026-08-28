import * as z from 'zod';
import { whiteboardSceneSchema } from '../WhiteboardScene';
import type { WhiteboardScene } from '../WhiteboardScene';

export const WHITEBOARD_COLLABORATION_PATH = '/whiteboard-collaboration/socket.io';
export const MAX_WHITEBOARD_CONFLICT_RETRIES = 3;

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
  x: z.number().min(-10_000_000).max(10_000_000),
  y: z.number().min(-10_000_000).max(10_000_000),
});

const canonicalSceneSchema = z.object({
  revision: z.number().int().positive(),
  scene: whiteboardSceneSchema,
  updatedAt: z.iso.datetime(),
});

export const whiteboardSaveAcknowledgementSchema = z.discriminatedUnion('status', [
  canonicalSceneSchema.extend({ clientMutationId: z.uuid(), status: z.literal('conflict') }),
  canonicalSceneSchema.extend({ clientMutationId: z.uuid(), status: z.literal('saved') }),
  z.object({
    clientMutationId: z.uuid(),
    message: z.enum(['permission-denied', 'persistence-failed']),
    status: z.literal('error'),
  }),
]);

export type WhiteboardCollaborationMember = {
  id: string;
  image: string | null;
  name: string;
  pointer?: z.infer<typeof whiteboardPointerSchema>;
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
  presence: (pointer: unknown) => void;
  save: (candidate: unknown, acknowledge: (result: WhiteboardSaveAcknowledgement) => void) => void;
};

export type WhiteboardServerToClientEvents = {
  baseline: (baseline: WhiteboardBaseline) => void;
  canonical: (canonical: WhiteboardCanonicalScene) => void;
  frozen: (reason: 'permission-denied' | 'service-unavailable') => void;
  presence: (members: WhiteboardCollaborationMember[]) => void;
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
