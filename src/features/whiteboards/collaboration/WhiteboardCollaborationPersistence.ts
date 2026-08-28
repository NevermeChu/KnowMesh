import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/libs/DB';
import {
  documentsSchema,
  documentWhiteboardStatesSchema,
  projectsSchema,
  workspacesSchema,
} from '@/models/Schema';
import { whiteboardSceneSchema } from '../WhiteboardScene';
import type { WhiteboardScene } from '../WhiteboardScene';
import type { WhiteboardCanonicalScene } from './WhiteboardCollaborationProtocol';

function toCanonicalScene(state: { revision: number; scene: unknown; updatedAt: Date }) {
  return {
    revision: state.revision,
    scene: whiteboardSceneSchema.parse(state.scene),
    updatedAt: state.updatedAt.toISOString(),
  } satisfies WhiteboardCanonicalScene;
}

export async function loadTeamWhiteboardCanonicalScene(documentId: string) {
  const [state] = await db
    .select({
      documentKind: documentsSchema.kind,
      revision: documentWhiteboardStatesSchema.revision,
      scene: documentWhiteboardStatesSchema.scene,
      updatedAt: documentWhiteboardStatesSchema.updatedAt,
      workspaceKind: workspacesSchema.kind,
    })
    .from(documentsSchema)
    .innerJoin(
      documentWhiteboardStatesSchema,
      eq(documentWhiteboardStatesSchema.documentId, documentsSchema.id),
    )
    .innerJoin(projectsSchema, eq(projectsSchema.id, documentsSchema.projectId))
    .innerJoin(workspacesSchema, eq(workspacesSchema.id, projectsSchema.workspaceId))
    .where(eq(documentsSchema.id, documentId))
    .limit(1);

  if (!state || state.documentKind !== 'whiteboard' || state.workspaceKind !== 'team') {
    throw new Error('permission-denied');
  }
  return toCanonicalScene(state);
}

export async function saveTeamWhiteboardCandidate(options: {
  documentId: string;
  expectedRevision: number;
  scene: WhiteboardScene;
}) {
  return await db.transaction(async (transaction) => {
    const [document] = await transaction
      .select({
        documentKind: documentsSchema.kind,
        id: documentsSchema.id,
        workspaceKind: workspacesSchema.kind,
      })
      .from(documentsSchema)
      .innerJoin(projectsSchema, eq(projectsSchema.id, documentsSchema.projectId))
      .innerJoin(workspacesSchema, eq(workspacesSchema.id, projectsSchema.workspaceId))
      .where(eq(documentsSchema.id, options.documentId))
      .limit(1)
      .for('update', { of: documentsSchema });
    if (!document || document.documentKind !== 'whiteboard' || document.workspaceKind !== 'team') {
      throw new Error('permission-denied');
    }

    const [state] = await transaction
      .select({
        revision: documentWhiteboardStatesSchema.revision,
        scene: documentWhiteboardStatesSchema.scene,
        updatedAt: documentWhiteboardStatesSchema.updatedAt,
      })
      .from(documentWhiteboardStatesSchema)
      .where(eq(documentWhiteboardStatesSchema.documentId, document.id))
      .limit(1)
      .for('update', { of: documentWhiteboardStatesSchema });
    if (!state) {
      throw new Error('whiteboard-state-missing');
    }
    if (state.revision !== options.expectedRevision) {
      return { ...toCanonicalScene(state), status: 'conflict' as const };
    }

    const savedAt = new Date();
    const [saved] = await transaction
      .update(documentWhiteboardStatesSchema)
      .set({
        revision: sql`${documentWhiteboardStatesSchema.revision} + 1`,
        scene: options.scene,
        updatedAt: savedAt,
      })
      .where(
        and(
          eq(documentWhiteboardStatesSchema.documentId, document.id),
          eq(documentWhiteboardStatesSchema.revision, options.expectedRevision),
        ),
      )
      .returning({
        revision: documentWhiteboardStatesSchema.revision,
        scene: documentWhiteboardStatesSchema.scene,
        updatedAt: documentWhiteboardStatesSchema.updatedAt,
      });
    if (!saved) {
      throw new Error('whiteboard-cas-failed');
    }

    await transaction
      .update(documentsSchema)
      .set({ updatedAt: savedAt })
      .where(eq(documentsSchema.id, document.id));
    return { ...toCanonicalScene(saved), status: 'saved' as const };
  });
}
