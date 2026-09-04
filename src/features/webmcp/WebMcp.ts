export type WebMcpTool = {
  annotations?: {
    readOnlyHint?: boolean;
    untrustedContentHint?: boolean;
  };
  description: string;
  execute: (input: unknown) => unknown;
  inputSchema: Record<string, unknown>;
  name: string;
  title?: string;
};

export type WebMcpModelContext = {
  registerTool: (tool: WebMcpTool, options?: { signal?: AbortSignal }) => Promise<void>;
};

const isWebMcpModelContext = (value: unknown): value is WebMcpModelContext =>
  typeof value === 'object' &&
  value !== null &&
  'registerTool' in value &&
  typeof value.registerTool === 'function';

export function getWebMcpModelContext(target: Document) {
  const modelContext: unknown = Reflect.get(target, 'modelContext');
  return isWebMcpModelContext(modelContext) ? modelContext : null;
}
