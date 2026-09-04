'use client';

import { useEffect } from 'react';
import { registerKnowMeshWebMcpTools } from '../RegisterKnowMeshWebMcpTools';
import { getWebMcpModelContext } from '../WebMcp';

/**
 * Registers KnowMesh tools when the authenticated page runs in a WebMCP-capable browser.
 *
 * @returns No visible UI.
 */
export function KnowMeshWebMcpTools() {
  useEffect(() => {
    const modelContext = getWebMcpModelContext(document);

    return modelContext ? registerKnowMeshWebMcpTools({ modelContext }) : undefined;
  }, []);

  return null;
}
