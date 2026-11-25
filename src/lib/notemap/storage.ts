import { projectLocalStorage } from '../../core/storage/projectStorage';
import { computeAutoLayout, getOrderedChildren, getRootNodeIds } from './layout';
import type { MindmapNode, MindmapState, NoteMapDocument, NoteMapWorkspaceData } from './types';

export const NOTEMAP_STORAGE_KEY = 'nexus_security_notemap_v1';

export function createNodeId(): string {
  return `node_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function createEdgeId(): string {
  return `edge_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function createDocId(): string {
  return `doc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

/** Creates a default starter security attack-map + engagement scratchpad document. */
export function createStarterDocument(title = 'Attack Surface & Notes'): NoteMapDocument {
  const rootId = 'node_root_1';
  const reconId = 'node_recon_1';
  const authId = 'node_auth_1';
  const apiId = 'node_api_1';
  const pocId = 'node_poc_1';

  const nodes: Record<string, MindmapNode> = {
    [rootId]: {
      id: rootId,
      parentId: null,
      text: 'Target Attack Surface',
      notes: 'Primary assessment goal, threat model, and engagement boundaries.',
      position: { x: 80, y: 180 },
      size: { width: 210, height: 58 },
      accent: 'emerald',
      childOrder: [reconId, authId],
      tag: 'Scope',
    },
    [reconId]: {
      id: reconId,
      parentId: rootId,
      text: 'Recon & Enumeration',
      notes: 'Subdomains, API Swagger specs, exposed admin paths.',
      position: { x: 360, y: 100 },
      size: { width: 204, height: 56 },
      accent: 'sky',
      childOrder: [apiId],
      tag: 'Recon',
    },
    [authId]: {
      id: authId,
      parentId: rootId,
      text: 'Auth & Session Checks',
      notes: 'JWT alg confusion, password reset tokens, OAuth redirect URI validation.',
      position: { x: 360, y: 260 },
      size: { width: 204, height: 56 },
      accent: 'amber',
      childOrder: [pocId],
      tag: 'Auth',
    },
    [apiId]: {
      id: apiId,
      parentId: reconId,
      text: 'API BOLA / IDOR Vectors',
      notes: 'Verify /api/v2/transactions/{id} ownership enforcement.',
      position: { x: 640, y: 100 },
      size: { width: 204, height: 56 },
      accent: 'rose',
      childOrder: [],
      tag: 'Critical',
    },
    [pocId]: {
      id: pocId,
      parentId: authId,
      text: 'Privilege Escalation Path',
      notes: 'Chain weak session scope + admin endpoint exposure.',
      position: { x: 640, y: 260 },
      size: { width: 204, height: 56 },
      accent: 'violet',
      childOrder: [],
      tag: 'Pivot',
    },
  };

  const mindmap: MindmapState = {
    nodes,
    edges: {
      edge_cross_1: {
        id: 'edge_cross_1',
        source: apiId,
        target: pocId,
        label: 'token reuse',
        dashed: true,
      },
    },
    layout: 'right',
  };

  const auto = computeAutoLayout(mindmap, 'right');
  for (const [id, pos] of Object.entries(auto)) {
    if (mindmap.nodes[id]) mindmap.nodes[id].position = pos;
  }

  return {
    id: createDocId(),
    title,
    mode: 'mindmap',
    tags: ['VAPT', 'Scratchpad'],
    noteContent: `# Engagement Field Notes

## Active Targets
- \`https://app.target-system.com\`
- \`https://api.target-system.com/v2\`

## Testing Checklist
- [x] Verify JWT validation & expiry enforcement
- [ ] Fuzz \`transaction_id\` and \`account_id\` parameters for BOLA / IDOR
- [ ] Check rate limiting on \`/api/v1/auth/login\`

## Observations & Hypotheses
> Tip: Switch to **Mindmap** or **Split** above, or click **Sync Headings → Map** to convert Markdown headings into an interactive attack tree.
`,
    mindmap,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    pinned: true,
  };
}

export function createBlankDocument(mode: NoteMapDocument['mode'] = 'note', title?: string): NoteMapDocument {
  const rootId = createNodeId();
  return {
    id: createDocId(),
    title: title || (mode === 'mindmap' ? 'New Attack Mindmap' : 'New Security Note'),
    mode,
    tags: [],
    noteContent: `# ${title || 'Security Notes'}\n\n- Key finding or observation\n- Evidence / payload reference\n`,
    mindmap: {
      nodes: {
        [rootId]: {
          id: rootId,
          parentId: null,
          text: title || 'Central Topic',
          position: { x: 140, y: 200 },
          size: { width: 210, height: 58 },
          accent: 'emerald',
          childOrder: [],
        },
      },
      edges: {},
      layout: 'right',
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/** Loads persisted workspace data safely for the active engagement project. */
export function loadNoteMapWorkspace(): NoteMapWorkspaceData {
  try {
    const raw = projectLocalStorage.getItem(NOTEMAP_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<NoteMapWorkspaceData>;
      if (parsed && Array.isArray(parsed.documents) && parsed.documents.length > 0) {
        const activeDocId =
          parsed.activeDocId && parsed.documents.some((d) => d.id === parsed.activeDocId)
            ? parsed.activeDocId
            : parsed.documents[0].id;
        return {
          version: 1,
          activeDocId,
          documents: parsed.documents,
        };
      }
    }
  } catch (err) {
    console.warn('Failed to parse persisted NoteMap workspace:', err);
  }

  const starter = createStarterDocument();
  return {
    version: 1,
    activeDocId: starter.id,
    documents: [starter],
  };
}

export function saveNoteMapWorkspace(data: NoteMapWorkspaceData): void {
  projectLocalStorage.setItem(NOTEMAP_STORAGE_KEY, JSON.stringify(data));
}

/** Converts a mindmap hierarchy into clean nested Markdown outline text. */
export function mindmapToMarkdownOutline(map: MindmapState, title = 'Mindmap Outline'): string {
  const lines: string[] = [`# ${title}`, ''];
  const roots = getRootNodeIds(map.nodes);
  const visited = new Set<string>();

  const walk = (id: string, depth: number) => {
    if (visited.has(id)) return;
    const node = map.nodes[id];
    if (!node) return;
    visited.add(id);

    const indent = '  '.repeat(Math.max(0, depth - 1));
    const tagPrefix = node.tag ? `[${node.tag}] ` : '';
    if (depth === 0) {
      lines.push(`## ${tagPrefix}${node.text || 'Topic'}`);
    } else {
      lines.push(`${indent}- ${tagPrefix}**${node.text || 'Node'}**`);
    }
    if (node.notes?.trim()) {
      lines.push(`${depth === 0 ? '' : `${indent}  `}> ${node.notes.trim().replace(/\n/g, ' ')}`);
    }

    for (const childId of getOrderedChildren(map.nodes, id)) {
      walk(childId, depth + 1);
    }
  };

  roots.forEach((rootId) => walk(rootId, 0));
  return lines.join('\n').trim() + '\n';
}

/** Parses Markdown headings (#, ##, ###) and top-level bullets into a tidy MindmapState. */
export function markdownToMindmap(markdown: string, fallbackTitle = 'Security Notes'): MindmapState {
  const lines = markdown.split(/\r?\n/);
  const nodes: Record<string, MindmapNode> = {};
  const stack: Array<{ depth: number; id: string }> = [];

  const ensureRoot = (): string => {
    const existing = getRootNodeIds(nodes)[0];
    if (existing) return existing;
    const id = createNodeId();
    nodes[id] = {
      id,
      parentId: null,
      text: fallbackTitle,
      position: { x: 80, y: 120 },
      size: { width: 210, height: 58 },
      accent: 'emerald',
      childOrder: [],
    };
    stack.push({ depth: 1, id });
    return id;
  };

  const accents: MindmapNode['accent'][] = ['emerald', 'sky', 'amber', 'violet', 'rose'];

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const headingMatch = line.match(/^(#{1,4})\s+(.+)$/);
    const bulletMatch = line.match(/^(\s*)[-*]\s+(?:\[[ xX]\]\s+)?(.+)$/);

    if (!headingMatch && !bulletMatch) continue;

    const depth = headingMatch
      ? headingMatch[1].length
      : Math.floor((bulletMatch![1].length || 0) / 2) + 5;
    const rawText = (headingMatch ? headingMatch[2] : bulletMatch![2])
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/`(.+?)`/g, '$1')
      .trim();

    if (!rawText) continue;

    while (stack.length > 0 && stack[stack.length - 1].depth >= depth) {
      stack.pop();
    }

    const parentId = stack.length > 0 ? stack[stack.length - 1].id : depth === 1 ? null : ensureRoot();
    const id = createNodeId();
    nodes[id] = {
      id,
      parentId,
      text: rawText.slice(0, 90),
      position: { x: 80, y: 120 },
      size: { width: 204, height: 56 },
      accent: accents[Math.min(depth - 1, accents.length - 1)],
      childOrder: [],
    };
    if (parentId && nodes[parentId]) {
      nodes[parentId].childOrder.push(id);
    }
    stack.push({ depth, id });
  }

  if (Object.keys(nodes).length === 0) {
    ensureRoot();
  }

  const state: MindmapState = { nodes, edges: {}, layout: 'right' };
  const layoutPositions = computeAutoLayout(state, 'right');
  for (const [id, pos] of Object.entries(layoutPositions)) {
    if (state.nodes[id]) state.nodes[id].position = pos;
  }
  return state;
}
