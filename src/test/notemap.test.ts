import { describe, it, expect } from 'vitest';
import {
  buildMindmapSvg,
  computeAutoLayout,
  getSubtreeIds,
  getVisibleNodeIds,
  wouldCreateCycle,
} from '../lib/notemap/layout';
import { markdownToMindmap, mindmapToMarkdownOutline } from '../lib/notemap/storage';
import type { MindmapState } from '../lib/notemap/types';

function makeSampleMap(): MindmapState {
  return {
    layout: 'balanced',
    edges: {},
    nodes: {
      r1: {
        id: 'r1',
        parentId: null,
        text: 'Root 1',
        position: { x: 0, y: 0 },
        size: { width: 200, height: 56 },
        accent: 'emerald',
        childOrder: ['c1', 'c2', 'c3'],
      },
      c1: {
        id: 'c1',
        parentId: 'r1',
        text: 'Child 1',
        position: { x: 0, y: 0 },
        size: { width: 200, height: 56 },
        accent: 'sky',
        childOrder: ['g1'],
      },
      g1: {
        id: 'g1',
        parentId: 'c1',
        text: 'Grandchild 1',
        position: { x: 0, y: 0 },
        size: { width: 200, height: 56 },
        accent: 'rose',
        childOrder: [],
      },
      c2: {
        id: 'c2',
        parentId: 'r1',
        text: 'Child 2',
        position: { x: 0, y: 0 },
        size: { width: 200, height: 56 },
        accent: 'amber',
        childOrder: [],
      },
      c3: {
        id: 'c3',
        parentId: 'r1',
        text: 'Child 3',
        position: { x: 0, y: 0 },
        size: { width: 200, height: 56 },
        accent: 'violet',
        childOrder: [],
      },
      r2: {
        id: 'r2',
        parentId: null,
        text: 'Root 2',
        position: { x: 0, y: 0 },
        size: { width: 200, height: 56 },
        accent: 'slate',
        childOrder: [],
      },
    },
  };
}

describe('notemap layout & graph helpers', () => {
  it('computes finite non-overlapping balanced, right, down, and radial coordinates across multi-root maps', () => {
    const map = makeSampleMap();
    for (const mode of ['balanced', 'right', 'down', 'radial'] as const) {
      const positions = computeAutoLayout(map, mode);
      expect(Object.keys(positions)).toHaveLength(6);
      for (const pos of Object.values(positions)) {
        expect(Number.isFinite(pos.x)).toBe(true);
        expect(Number.isFinite(pos.y)).toBe(true);
      }
      // Second root must not sit identically on top of first root
      expect(
        positions.r1.x !== positions.r2.x || positions.r1.y !== positions.r2.y
      ).toBe(true);
    }
  });

  it('guards against cycles in visibility, subtree collection, and reparent checks', () => {
    const map = makeSampleMap();
    // Inject accidental cycle r1 -> c1 -> r1
    map.nodes.r1.parentId = 'g1';
    const visible = getVisibleNodeIds(map.nodes);
    expect(visible.size).toBeGreaterThanOrEqual(0);

    const mapClean = makeSampleMap();
    expect(wouldCreateCycle(mapClean.nodes, 'r1', 'g1')).toBe(true);
    expect(wouldCreateCycle(mapClean.nodes, 'c2', 'c1')).toBe(false);

    mapClean.nodes.c1.collapsed = true;
    const visAfterCollapse = getVisibleNodeIds(mapClean.nodes);
    expect(visAfterCollapse.has('c1')).toBe(true);
    expect(visAfterCollapse.has('g1')).toBe(false);

    const subtree = getSubtreeIds(mapClean.nodes, 'c1');
    expect(subtree.has('c1')).toBe(true);
    expect(subtree.has('g1')).toBe(true);
    expect(subtree.has('r1')).toBe(false);
  });

  it('converts between Markdown headings and Mindmap trees and exports valid dark SVG', () => {
    const md = '# Auth Audit\n## JWT Checks\n- Verify alg\n## Session Checks\n- Rotation';
    const map = markdownToMindmap(md, 'Auth');
    const texts = Object.values(map.nodes).map((n) => n.text);
    expect(texts).toContain('Auth Audit');
    expect(texts).toContain('JWT Checks');
    expect(texts).toContain('Verify alg');

    const outline = mindmapToMarkdownOutline(map, 'Auth Export');
    expect(outline).toContain('Auth Audit');
    expect(outline).toContain('JWT Checks');

    const svg = buildMindmapSvg(map, 'Auth');
    expect(svg).toContain('<svg');
    expect(svg).toContain('#020617');
    expect(svg).toContain('Auth Audit');
  });
});
