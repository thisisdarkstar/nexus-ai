import type { MindmapLayoutMode, MindmapNode, MindmapState, NodeAccent, Point } from './types';

export const DEFAULT_NODE_SIZE = { width: 204, height: 56 };
const LEVEL_GAP_X = 68;
const LEVEL_GAP_Y = 58;
const SIBLING_GAP = 28;

export const NODE_ACCENT_COLORS: Record<NodeAccent, { border: string; bg: string; badge: string; text: string }> = {
  slate: { border: '#475569', bg: '#0f172a', badge: '#94a3b8', text: '#f8fafc' },
  emerald: { border: '#10b981', bg: '#06281e', badge: '#34d399', text: '#ecfdf5' },
  sky: { border: '#38bdf8', bg: '#08263a', badge: '#7dd3fc', text: '#f0f9ff' },
  amber: { border: '#f59e0b', bg: '#2e1d07', badge: '#fcd34d', text: '#fffbeb' },
  rose: { border: '#ef4444', bg: '#310d14', badge: '#fca5a5', text: '#fef2f2' },
  violet: { border: '#8b5cf6', bg: '#1e133b', badge: '#c4b5fd', text: '#f5f3ff' },
};

/** Returns root node IDs (nodes with no valid parentId) preserving deterministic order. */
export function getRootNodeIds(nodes: Record<string, MindmapNode>): string[] {
  return Object.values(nodes)
    .filter((n) => !n.parentId || !nodes[n.parentId])
    .map((n) => n.id);
}

/** Returns valid ordered child IDs for a given parent node. */
export function getOrderedChildren(nodes: Record<string, MindmapNode>, parentId: string): string[] {
  const parent = nodes[parentId];
  if (!parent) return [];
  const seen = new Set<string>();
  const ordered: string[] = [];

  for (const childId of parent.childOrder || []) {
    const child = nodes[childId];
    if (child && child.parentId === parentId && !seen.has(childId)) {
      seen.add(childId);
      ordered.push(childId);
    }
  }
  for (const node of Object.values(nodes)) {
    if (node.parentId === parentId && !seen.has(node.id)) {
      seen.add(node.id);
      ordered.push(node.id);
    }
  }
  return ordered;
}

/** Traverses all visible nodes (skipping descendants of collapsed nodes) with cycle safety. */
export function getVisibleNodeIds(nodes: Record<string, MindmapNode>): Set<string> {
  const visible = new Set<string>();
  const roots = getRootNodeIds(nodes);

  const walk = (id: string, ancestors: Set<string>) => {
    const node = nodes[id];
    if (!node || ancestors.has(id)) return;
    visible.add(id);
    if (node.collapsed) return;
    const nextAncestors = new Set(ancestors);
    nextAncestors.add(id);
    for (const childId of getOrderedChildren(nodes, id)) {
      walk(childId, nextAncestors);
    }
  };

  for (const rootId of roots) {
    walk(rootId, new Set());
  }

  // Fallback for any cyclic component whose members have no non-cyclic root
  for (const id of Object.keys(nodes)) {
    if (!visible.has(id)) {
      const node = nodes[id];
      if (!node.parentId || !nodes[node.parentId]) {
        visible.add(id);
      }
    }
  }

  return visible;
}

/** Collects `rootId` and all of its reachable descendants safely (cycle-guarded). */
export function getSubtreeIds(nodes: Record<string, MindmapNode>, rootId: string): Set<string> {
  const result = new Set<string>();
  const stack = [rootId];
  while (stack.length > 0) {
    const current = stack.pop()!;
    if (result.has(current) || !nodes[current]) continue;
    result.add(current);
    for (const childId of getOrderedChildren(nodes, current)) {
      stack.push(childId);
    }
  }
  return result;
}

/** Counts direct + transitive descendants under `nodeId` safely. */
export function countDescendants(nodes: Record<string, MindmapNode>, nodeId: string): number {
  const subtree = getSubtreeIds(nodes, nodeId);
  return Math.max(0, subtree.size - 1);
}

/** Checks whether setting `candidateParentId` as parent of `nodeId` would create a cycle. */
export function wouldCreateCycle(
  nodes: Record<string, MindmapNode>,
  nodeId: string,
  candidateParentId: string | null
): boolean {
  if (!candidateParentId) return false;
  if (candidateParentId === nodeId) return true;
  const visited = new Set<string>([nodeId]);
  let curr: string | null = candidateParentId;
  while (curr) {
    if (visited.has(curr)) return true;
    visited.add(curr);
    curr = nodes[curr]?.parentId ?? null;
  }
  return false;
}

function measureSubtreeHeight(
  nodes: Record<string, MindmapNode>,
  id: string,
  cache: Map<string, number>,
  ancestors: Set<string>
): number {
  if (cache.has(id)) return cache.get(id)!;
  const node = nodes[id];
  if (!node || ancestors.has(id)) return 0;

  const h = node.size?.height || DEFAULT_NODE_SIZE.height;
  const children = node.collapsed ? [] : getOrderedChildren(nodes, id);
  if (children.length === 0) {
    cache.set(id, h);
    return h;
  }

  const nextAncestors = new Set(ancestors);
  nextAncestors.add(id);
  const childrenSum = children.reduce(
    (sum, c) => sum + measureSubtreeHeight(nodes, c, cache, nextAncestors),
    0
  );
  const total = Math.max(h, childrenSum + SIBLING_GAP * Math.max(children.length - 1, 0));
  cache.set(id, total);
  return total;
}

function measureSubtreeWidth(
  nodes: Record<string, MindmapNode>,
  id: string,
  cache: Map<string, number>,
  ancestors: Set<string>
): number {
  if (cache.has(id)) return cache.get(id)!;
  const node = nodes[id];
  if (!node || ancestors.has(id)) return 0;

  const w = node.size?.width || DEFAULT_NODE_SIZE.width;
  const children = node.collapsed ? [] : getOrderedChildren(nodes, id);
  if (children.length === 0) {
    cache.set(id, w);
    return w;
  }

  const nextAncestors = new Set(ancestors);
  nextAncestors.add(id);
  const childrenSum = children.reduce(
    (sum, c) => sum + measureSubtreeWidth(nodes, c, cache, nextAncestors),
    0
  );
  const total = Math.max(w, childrenSum + SIBLING_GAP * Math.max(children.length - 1, 0));
  cache.set(id, total);
  return total;
}

/**
 * Computes clean non-overlapping positions for visible nodes in the mindmap.
 * Hidden descendants follow their visible collapsed ancestor offset.
 */
export function computeAutoLayout(
  map: MindmapState,
  mode: MindmapLayoutMode = map.layout
): Record<string, Point> {
  const { nodes } = map;
  const roots = getRootNodeIds(nodes);
  const positions: Record<string, Point> = {};
  if (roots.length === 0) return positions;

  if (mode === 'down') {
    const widths = new Map<string, number>();
    let cursorX = 80;
    const placeDown = (id: string, left: number, top: number, ancestors: Set<string>) => {
      const node = nodes[id];
      if (!node || ancestors.has(id)) return;
      const nw = node.size?.width || DEFAULT_NODE_SIZE.width;
      const nh = node.size?.height || DEFAULT_NODE_SIZE.height;
      const treeW = widths.get(id) ?? nw;
      positions[id] = { x: Math.round(left + treeW / 2 - nw / 2), y: Math.round(top) };

      if (node.collapsed) return;
      const children = getOrderedChildren(nodes, id);
      const nextAnc = new Set(ancestors);
      nextAnc.add(id);
      let childLeft = left;
      for (const childId of children) {
        const cw = widths.get(childId) ?? DEFAULT_NODE_SIZE.width;
        placeDown(childId, childLeft, top + nh + LEVEL_GAP_Y, nextAnc);
        childLeft += cw + SIBLING_GAP;
      }
    };

    for (const rootId of roots) {
      measureSubtreeWidth(nodes, rootId, widths, new Set());
      const rootW = widths.get(rootId) ?? DEFAULT_NODE_SIZE.width;
      placeDown(rootId, cursorX, 80, new Set());
      cursorX += rootW + LEVEL_GAP_X;
    }
  } else if (mode === 'balanced') {
    const heights = new Map<string, number>();
    for (const rootId of roots) {
      measureSubtreeHeight(nodes, rootId, heights, new Set());
    }

    const placeBranch = (
      id: string,
      anchorX: number,
      top: number,
      dir: 1 | -1,
      ancestors: Set<string>
    ) => {
      const node = nodes[id];
      if (!node || ancestors.has(id)) return;
      const nw = node.size?.width || DEFAULT_NODE_SIZE.width;
      const nh = node.size?.height || DEFAULT_NODE_SIZE.height;
      const treeH = heights.get(id) ?? nh;
      const x = dir === 1 ? anchorX : anchorX - nw;
      const y = top + treeH / 2 - nh / 2;
      positions[id] = { x: Math.round(x), y: Math.round(y) };

      if (node.collapsed) return;
      const children = getOrderedChildren(nodes, id);
      const nextAnc = new Set(ancestors);
      nextAnc.add(id);
      let childTop = top;
      for (const childId of children) {
        const ch = heights.get(childId) ?? DEFAULT_NODE_SIZE.height;
        const nextX = dir === 1 ? anchorX + nw + LEVEL_GAP_X : anchorX - nw - LEVEL_GAP_X;
        placeBranch(childId, nextX, childTop, dir, nextAnc);
        childTop += ch + SIBLING_GAP;
      }
    };

    let rootCursorY = 120;
    for (const rootId of roots) {
      const root = nodes[rootId];
      if (!root) continue;
      const rw = root.size?.width || DEFAULT_NODE_SIZE.width;
      const rh = root.size?.height || DEFAULT_NODE_SIZE.height;
      const children = root.collapsed ? [] : getOrderedChildren(nodes, rootId);
      const splitIdx = Math.ceil(children.length / 2);
      const rightChildren = children.slice(0, splitIdx);
      const leftChildren = children.slice(splitIdx);

      const sumHeight = (list: string[]) =>
        list.reduce((s, cid) => s + (heights.get(cid) ?? DEFAULT_NODE_SIZE.height), 0) +
        SIBLING_GAP * Math.max(list.length - 1, 0);

      const rightH = sumHeight(rightChildren);
      const leftH = sumHeight(leftChildren);
      const blockH = Math.max(rh, rightH, leftH);
      const centerX = 480;
      const rootY = rootCursorY + blockH / 2 - rh / 2;
      positions[rootId] = { x: Math.round(centerX - rw / 2), y: Math.round(rootY) };

      const rootAnc = new Set([rootId]);
      let rTop = rootCursorY + (blockH - rightH) / 2;
      for (const childId of rightChildren) {
        const ch = heights.get(childId) ?? DEFAULT_NODE_SIZE.height;
        placeBranch(childId, centerX + rw / 2 + LEVEL_GAP_X, rTop, 1, rootAnc);
        rTop += ch + SIBLING_GAP;
      }

      let lTop = rootCursorY + (blockH - leftH) / 2;
      for (const childId of leftChildren) {
        const ch = heights.get(childId) ?? DEFAULT_NODE_SIZE.height;
        placeBranch(childId, centerX - rw / 2 - LEVEL_GAP_X, lTop, -1, rootAnc);
        lTop += ch + SIBLING_GAP;
      }

      rootCursorY += blockH + LEVEL_GAP_Y * 1.5;
    }
  } else if (mode === 'radial') {
    const cx0 = 520;
    const cy0 = 340;
    const ringRadiusStep = 230;
    const rootRingOffset = roots.length > 1 ? 260 : 0;

    roots.forEach((rootId, rIdx) => {
      const root = nodes[rootId];
      if (!root) return;
      const rootAngle = (rIdx / Math.max(roots.length, 1)) * Math.PI * 2;
      const rx = cx0 + Math.cos(rootAngle) * rootRingOffset;
      const ry = cy0 + Math.sin(rootAngle) * rootRingOffset;

      const assignRadial = (
        id: string,
        centerX: number,
        centerY: number,
        depth: number,
        sectorStart: number,
        sectorEnd: number,
        ancestors: Set<string>
      ) => {
        const node = nodes[id];
        if (!node || ancestors.has(id)) return;
        const nw = node.size?.width || DEFAULT_NODE_SIZE.width;
        const nh = node.size?.height || DEFAULT_NODE_SIZE.height;
        positions[id] = { x: Math.round(centerX - nw / 2), y: Math.round(centerY - nh / 2) };

        if (node.collapsed) return;
        const children = getOrderedChildren(nodes, id);
        if (children.length === 0) return;

        const nextAnc = new Set(ancestors);
        nextAnc.add(id);
        const span = sectorEnd - sectorStart;
        const step = span / children.length;
        const radius = ringRadiusStep * (depth === 0 ? 1 : 0.92);

        children.forEach((childId, idx) => {
          const angle = sectorStart + step * (idx + 0.5);
          assignRadial(
            childId,
            centerX + Math.cos(angle) * radius,
            centerY + Math.sin(angle) * radius,
            depth + 1,
            sectorStart + step * idx,
            sectorStart + step * (idx + 1),
            nextAnc
          );
        });
      };

      const rootSectorSpan = (Math.PI * 2) / Math.max(roots.length, 1);
      assignRadial(
        rootId,
        rx,
        ry,
        0,
        rootAngle - rootSectorSpan / 2,
        rootAngle + rootSectorSpan / 2,
        new Set()
      );
    });
  } else {
    // Default 'right' tidy horizontal hierarchy
    const heights = new Map<string, number>();
    let cursorY = 80;
    const placeRight = (id: string, left: number, top: number, ancestors: Set<string>) => {
      const node = nodes[id];
      if (!node || ancestors.has(id)) return;
      const nw = node.size?.width || DEFAULT_NODE_SIZE.width;
      const nh = node.size?.height || DEFAULT_NODE_SIZE.height;
      const treeH = heights.get(id) ?? nh;
      positions[id] = { x: Math.round(left), y: Math.round(top + treeH / 2 - nh / 2) };

      if (node.collapsed) return;
      const children = getOrderedChildren(nodes, id);
      const nextAnc = new Set(ancestors);
      nextAnc.add(id);
      let childTop = top;
      for (const childId of children) {
        const ch = heights.get(childId) ?? DEFAULT_NODE_SIZE.height;
        placeRight(childId, left + nw + LEVEL_GAP_X, childTop, nextAnc);
        childTop += ch + SIBLING_GAP;
      }
    };

    for (const rootId of roots) {
      measureSubtreeHeight(nodes, rootId, heights, new Set());
      const rh = heights.get(rootId) ?? DEFAULT_NODE_SIZE.height;
      placeRight(rootId, 80, cursorY, new Set());
      cursorY += rh + LEVEL_GAP_Y;
    }
  }

  // Keep any hidden nodes positioned safely at their visible ancestor
  for (const id of Object.keys(nodes)) {
    if (!positions[id]) {
      positions[id] = { ...nodes[id].position };
    }
  }

  return positions;
}

/** Computes a smooth cubic Bezier SVG path between two connected nodes. */
export function buildEdgePath(source: MindmapNode, target: MindmapNode): { path: string; midX: number; midY: number } {
  const sxCenter = source.position.x + source.size.width / 2;
  const syCenter = source.position.y + source.size.height / 2;
  const txCenter = target.position.x + target.size.width / 2;
  const tyCenter = target.position.y + target.size.height / 2;

  const dx = txCenter - sxCenter;
  const dy = tyCenter - syCenter;

  let sx = sxCenter;
  let sy = syCenter;
  let tx = txCenter;
  let ty = tyCenter;
  let c1x = sx;
  let c1y = sy;
  let c2x = tx;
  let c2y = ty;

  if (Math.abs(dx) >= Math.abs(dy)) {
    const forward = dx >= 0;
    sx = forward ? source.position.x + source.size.width : source.position.x;
    tx = forward ? target.position.x : target.position.x + target.size.width;
    const offset = Math.max(40, Math.abs(tx - sx) * 0.5);
    c1x = sx + (forward ? offset : -offset);
    c2x = tx + (forward ? -offset : offset);
    c1y = sy;
    c2y = ty;
  } else {
    const downward = dy >= 0;
    sy = downward ? source.position.y + source.size.height : source.position.y;
    ty = downward ? target.position.y : target.position.y + target.size.height;
    const offset = Math.max(36, Math.abs(ty - sy) * 0.5);
    c1x = sx;
    c2x = tx;
    c1y = sy + (downward ? offset : -offset);
    c2y = ty + (downward ? -offset : offset);
  }

  const path = `M ${sx} ${sy} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${tx} ${ty}`;
  const midX = (sx + tx) / 2;
  const midY = (sy + ty) / 2;
  return { path, midX, midY };
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Exports the current visible mindmap into a standalone dark SVG graphic. */
export function buildMindmapSvg(map: MindmapState, title = 'Attack Mindmap'): string {
  const visible = getVisibleNodeIds(map.nodes);
  const visibleNodes = [...visible].map((id) => map.nodes[id]).filter(Boolean);
  if (visibleNodes.length === 0) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="240"><rect width="100%" height="100%" fill="#020617"/><text x="300" y="120" fill="#94a3b8" text-anchor="middle" font-family="sans-serif">${escapeXml(title)} (empty)</text></svg>`;
  }

  const padding = 48;
  const minX = Math.min(...visibleNodes.map((n) => n.position.x)) - padding;
  const minY = Math.min(...visibleNodes.map((n) => n.position.y)) - padding;
  const maxX = Math.max(...visibleNodes.map((n) => n.position.x + n.size.width)) + padding;
  const maxY = Math.max(...visibleNodes.map((n) => n.position.y + n.size.height)) + padding;
  const width = Math.max(320, maxX - minX);
  const height = Math.max(240, maxY - minY);

  const edgeSvgs: string[] = [];
  for (const node of visibleNodes) {
    if (!node.parentId || !visible.has(node.parentId)) continue;
    const parent = map.nodes[node.parentId];
    if (!parent) continue;
    const { path } = buildEdgePath(parent, node);
    edgeSvgs.push(`<path d="${path}" fill="none" stroke="#475569" stroke-width="2" />`);
  }
  for (const edge of Object.values(map.edges)) {
    if (!visible.has(edge.source) || !visible.has(edge.target)) continue;
    const s = map.nodes[edge.source];
    const t = map.nodes[edge.target];
    if (!s || !t) continue;
    const { path } = buildEdgePath(s, t);
    edgeSvgs.push(
      `<path d="${path}" fill="none" stroke="#38bdf8" stroke-width="1.8" stroke-dasharray="6 4" />`
    );
  }

  const nodeSvgs = visibleNodes.map((node) => {
    const palette = NODE_ACCENT_COLORS[node.accent] || NODE_ACCENT_COLORS.slate;
    const lines = (node.text || 'Untitled').split('\n').slice(0, 2);
    const tspans = lines
      .map(
        (line, idx) =>
          `<tspan x="${node.position.x + 14}" dy="${idx === 0 ? 0 : 16}">${escapeXml(line.slice(0, 30))}</tspan>`
      )
      .join('');
    return `
      <g>
        <rect x="${node.position.x}" y="${node.position.y}" width="${node.size.width}" height="${node.size.height}" rx="10" fill="${palette.bg}" stroke="${palette.border}" stroke-width="1.75" />
        <text x="${node.position.x + 14}" y="${node.position.y + (lines.length > 1 ? 24 : 33)}" fill="${palette.text}" font-family="Inter, Segoe UI, sans-serif" font-size="13" font-weight="600">${tspans}</text>
      </g>`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${minY} ${width} ${height}" width="${width}" height="${height}">
  <rect x="${minX}" y="${minY}" width="${width}" height="${height}" fill="#020617" />
  ${edgeSvgs.join('\n  ')}
  ${nodeSvgs.join('\n  ')}
</svg>`;
}
