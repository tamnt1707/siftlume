import { PeleError, renderAsync, type RenderOptions } from 'pele/lazy';

/**
 * Mermaid → SVG with Pele (https://pele.run): client-side, synchronous layout, no eval, MIT.
 * `pele/lazy` loads each diagram type on first use, so flowchart users never pay for gantt etc.
 * Colors come from CSS variables (--pele-*) set in assets/genui.css, so diagrams follow the theme.
 */

const BASE_OPTIONS: RenderOptions = {
  fontFamily: '"Bricolage Grotesque Variable", ui-sans-serif, system-ui, sans-serif',
  responsive: true,
  // Left-to-right flows turn top-down when the container is narrow (side panel).
  autoDirection: true,
  padding: 12,
  // Model output is untrusted: no clickable links, no remote images.
  links: false,
  images: false,
  limit: 20_000,
};

let counter = 0;

export interface DiagramResult {
  svg: string;
  type: string;
}

export async function renderDiagram(source: string, options: RenderOptions = {}): Promise<DiagramResult> {
  // Unique id prefix per render: several diagrams on one page must not share marker/gradient ids.
  const { svg, type } = await renderAsync(source.trim(), {
    ...BASE_OPTIONS,
    idPrefix: `dg${++counter}-`,
    ...options,
  });
  return { svg, type };
}

/** LLM-readable description of why a Mermaid source failed, or null when it renders. */
export async function diagramError(source: string): Promise<string | null> {
  try {
    await renderDiagram(source);
    return null;
  } catch (e) {
    if (e instanceof PeleError) {
      const where = e.line ? ` (line ${e.line}, column ${e.column})` : '';
      const snippet = e.snippet ? ` near: ${e.snippet.trim().slice(0, 80)}` : '';
      return `Mermaid ${e.code} error${where}: ${e.message}${snippet}`;
    }
    return `Mermaid error: ${e instanceof Error ? e.message : String(e)}`;
  }
}

export { PeleError };
