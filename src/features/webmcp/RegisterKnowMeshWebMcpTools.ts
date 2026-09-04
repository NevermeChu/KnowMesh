import {
  readPersonalDocument,
  writePersonalDocument,
} from '@/features/webmcp/server/PersonalDocumentTools';
import type { WebMcpModelContext } from './WebMcp';

const documentIdInputSchema = {
  additionalProperties: false,
  properties: {
    documentId: {
      description: 'The UUID of one existing Personal rich-text document.',
      format: 'uuid',
      type: 'string',
    },
  },
  required: ['documentId'],
  type: 'object',
};

const emptyInputSchema = {
  additionalProperties: false,
  properties: {},
  type: 'object',
};

const getCurrentDocumentId = () => new URL(window.location.href).searchParams.get('document');

/**
 * Registers the bounded KnowMesh WebMCP tools.
 *
 * @param options - The browser registration surface and current-document resolver.
 * @returns A cleanup function that unregisters the tools.
 */
export function registerKnowMeshWebMcpTools(options: {
  getCurrentDocumentId?: () => string | null;
  modelContext: WebMcpModelContext;
}) {
  const controller = new AbortController();
  const registrationOptions = { signal: controller.signal };
  const resolveCurrentDocumentId = options.getCurrentDocumentId ?? getCurrentDocumentId;

  void Promise.allSettled([
    options.modelContext.registerTool(
      {
        annotations: { readOnlyHint: true, untrustedContentHint: true },
        description:
          'Reads the Personal rich-text document currently open in this browser tab. It cannot read Team documents or whiteboards.',
        execute: async () => {
          const documentId = resolveCurrentDocumentId();
          if (!documentId) {
            throw new Error('No document is currently open');
          }
          return await readPersonalDocument({ documentId });
        },
        inputSchema: emptyInputSchema,
        name: 'read_current_personal_document',
        title: 'Read current personal document',
      },
      registrationOptions,
    ),
    options.modelContext.registerTool(
      {
        description:
          'Replaces the complete ProseMirror JSON body of one existing Personal rich-text document. Pass the documentId and updatedAt values returned by read_current_personal_document to bind the write to that read and prevent overwriting concurrent edits. It cannot create, rename, move, delete, or change permissions.',
        execute: writePersonalDocument,
        inputSchema: {
          ...documentIdInputSchema,
          properties: {
            ...documentIdInputSchema.properties,
            content: {
              description: 'The complete validated ProseMirror JSON document.',
              type: 'object',
            },
            expectedUpdatedAt: {
              description: 'The updatedAt date-time returned by read_current_personal_document.',
              format: 'date-time',
              type: 'string',
            },
          },
          required: ['documentId', 'content', 'expectedUpdatedAt'],
        },
        name: 'write_personal_document',
        title: 'Write personal document',
      },
      registrationOptions,
    ),
  ]);

  return () => {
    controller.abort();
  };
}
