import { beforeEach, describe, expect, it, vi } from 'vitest';
import { registerKnowMeshWebMcpTools } from './RegisterKnowMeshWebMcpTools';
import type {
  readPersonalDocument as readPersonalDocumentFunction,
  writePersonalDocument as writePersonalDocumentFunction,
} from './server/PersonalDocumentTools';
import type { WebMcpModelContext, WebMcpTool } from './WebMcp';

const actions = vi.hoisted(() => ({
  readPersonalDocument: vi.fn<typeof readPersonalDocumentFunction>(),
  writePersonalDocument: vi.fn<typeof writePersonalDocumentFunction>(),
}));

vi.mock(import('@/features/webmcp/server/PersonalDocumentTools'), () => actions);

describe(registerKnowMeshWebMcpTools, () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registers only bounded Personal document tools', () => {
    const tools: WebMcpTool[] = [];
    const signals: AbortSignal[] = [];
    const modelContext: WebMcpModelContext = {
      // oxlint-disable-next-line eslint/require-await -- Mock follows the asynchronous browser API.
      registerTool: vi.fn<WebMcpModelContext['registerTool']>(async (tool, options) => {
        tools.push(tool);
        if (options?.signal) {
          signals.push(options.signal);
        }
      }),
    };

    const unregister = registerKnowMeshWebMcpTools({ modelContext });

    expect({
      names: tools.map((tool) => tool.name),
      readAnnotations: tools[0]?.annotations,
      readInputSchema: tools[0]?.inputSchema,
    }).toStrictEqual({
      names: ['read_current_personal_document', 'write_personal_document'],
      readAnnotations: { readOnlyHint: true, untrustedContentHint: true },
      readInputSchema: { additionalProperties: false, properties: {}, type: 'object' },
    });
    expect(signals).toHaveLength(2);
    expect(signals.every((signal) => !signal.aborted)).toBeTruthy();

    unregister();

    expect(signals.every((signal) => signal.aborted)).toBeTruthy();
  });

  it('connects each tool to its dedicated Server Action', async () => {
    const tools: WebMcpTool[] = [];
    const modelContext: WebMcpModelContext = {
      // oxlint-disable-next-line eslint/require-await -- Mock follows the asynchronous browser API.
      registerTool: vi.fn<WebMcpModelContext['registerTool']>(async (tool) => {
        tools.push(tool);
      }),
    };
    registerKnowMeshWebMcpTools({
      getCurrentDocumentId: () => '10000000-0000-4000-8000-000000000001',
      modelContext,
    });
    const readInput = { documentId: '10000000-0000-4000-8000-000000000001' };
    const writeInput = { ...readInput, content: { type: 'doc' }, expectedUpdatedAt: 'timestamp' };

    await tools[0]?.execute({});
    await tools[1]?.execute(writeInput);

    expect(actions.readPersonalDocument).toHaveBeenCalledWith(readInput);
    expect(actions.writePersonalDocument).toHaveBeenCalledWith(writeInput);
  });

  it('rejects reads without an open document', async () => {
    const tools: WebMcpTool[] = [];
    const modelContext: WebMcpModelContext = {
      // oxlint-disable-next-line eslint/require-await -- Mock follows the asynchronous browser API.
      registerTool: vi.fn<WebMcpModelContext['registerTool']>(async (tool) => {
        tools.push(tool);
      }),
    };
    registerKnowMeshWebMcpTools({ getCurrentDocumentId: () => null, modelContext });

    await expect(tools[0]?.execute({})).rejects.toThrow('No document is currently open');
    expect(actions.readPersonalDocument).not.toHaveBeenCalled();
  });
});
