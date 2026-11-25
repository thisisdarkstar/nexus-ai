import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Plus,
  GitBranch,
  Hand,
  MousePointer,
  Link2,
  LayoutGrid,
  Maximize2,
  ZoomIn,
  ZoomOut,
  Undo2,
  Redo2,
  Trash2,
  PanelRight,
  Sparkles,
  Grid,
  ChevronRight,
  Minus,
} from 'lucide-react';
import CustomSelect from '../common/CustomSelect';
import {
  NODE_ACCENT_COLORS,
  buildEdgePath,
  computeAutoLayout,
  countDescendants,
  getRootNodeIds,
  getSubtreeIds,
  getVisibleNodeIds,
  wouldCreateCycle,
} from '../../lib/notemap/layout';
import { createEdgeId, createNodeId } from '../../lib/notemap/storage';
import type { MindmapLayoutMode, MindmapNode, MindmapState, NodeAccent } from '../../lib/notemap/types';
import styles from './MindmapCanvas.module.css';

interface MindmapCanvasProps {
  mindmap: MindmapState;
  searchQuery?: string;
  onChange: (next: MindmapState) => void;
  onSendToAI?: (prompt: string) => void;
}

const ACCENT_OPTIONS: NodeAccent[] = ['emerald', 'sky', 'amber', 'rose', 'violet', 'slate'];
const LAYOUT_OPTIONS: Array<{ value: MindmapLayoutMode; label: string }> = [
  { value: 'right', label: 'Tree (Left → Right)' },
  { value: 'down', label: 'Hierarchy (Top → Down)' },
  { value: 'balanced', label: 'Balanced Mindmap' },
  { value: 'radial', label: 'Radial Attack Web' },
];

export default function MindmapCanvas({
  mindmap,
  searchQuery = '',
  onChange,
  onSendToAI,
}: MindmapCanvasProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [tool, setTool] = useState<'select' | 'pan' | 'connect'>('select');
  const [showGrid, setShowGrid] = useState(true);
  const [snapToGrid, setSnapToGrid] = useState(false);
  const [showInspector, setShowInspector] = useState(true);

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(
    () => getRootNodeIds(mindmap.nodes)[0] ?? Object.keys(mindmap.nodes)[0] ?? null
  );
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [connectSourceId, setConnectSourceId] = useState<string | null>(null);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState('');

  const [pan, setPan] = useState({ x: 24, y: 24 });
  const [zoom, setZoom] = useState(1);

  const [historyPast, setHistoryPast] = useState<MindmapState[]>([]);
  const [historyFuture, setHistoryFuture] = useState<MindmapState[]>([]);

  const dragRef = useRef<
    | { kind: 'pan'; startX: number; startY: number; startPanX: number; startPanY: number }
    | {
        kind: 'node';
        nodeId: string;
        startX: number;
        startY: number;
        origPos: { x: number; y: number };
        snapshotBefore: MindmapState;
        moved: boolean;
      }
    | null
  >(null);

  const commitChange = useCallback(
    (next: MindmapState, recordUndo = true) => {
      if (recordUndo) {
        setHistoryPast((prev) => [...prev.slice(-39), mindmap]);
        setHistoryFuture([]);
      }
      onChange(next);
    },
    [mindmap, onChange]
  );

  const handleUndo = useCallback(() => {
    setHistoryPast((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      setHistoryFuture((f) => [mindmap, ...f.slice(0, 39)]);
      onChange(last);
      return prev.slice(0, -1);
    });
  }, [mindmap, onChange]);

  const handleRedo = useCallback(() => {
    setHistoryFuture((prev) => {
      if (prev.length === 0) return prev;
      const [first, ...rest] = prev;
      setHistoryPast((p) => [...p.slice(-39), mindmap]);
      onChange(first);
      return rest;
    });
  }, [mindmap, onChange]);

  const visibleIds = useMemo(() => getVisibleNodeIds(mindmap.nodes), [mindmap.nodes]);
  const visibleNodeList = useMemo(
    () => [...visibleIds].map((id) => mindmap.nodes[id]).filter(Boolean),
    [mindmap.nodes, visibleIds]
  );

  // Keep selectedNodeId valid if nodes changed (e.g. switched document)
  useEffect(() => {
    if (selectedNodeId && mindmap.nodes[selectedNodeId]) return;
    setSelectedNodeId(getRootNodeIds(mindmap.nodes)[0] ?? Object.keys(mindmap.nodes)[0] ?? null);
  }, [mindmap.nodes, selectedNodeId]);

  const selectedNode = selectedNodeId ? mindmap.nodes[selectedNodeId] ?? null : null;

  const fitView = useCallback(() => {
    const stage = stageRef.current;
    if (!stage || visibleNodeList.length === 0) {
      setPan({ x: 32, y: 32 });
      setZoom(1);
      return;
    }
    const rect = stage.getBoundingClientRect();
    const minX = Math.min(...visibleNodeList.map((n) => n.position.x));
    const minY = Math.min(...visibleNodeList.map((n) => n.position.y));
    const maxX = Math.max(...visibleNodeList.map((n) => n.position.x + n.size.width));
    const maxY = Math.max(...visibleNodeList.map((n) => n.position.y + n.size.height));
    const contentW = Math.max(120, maxX - minX);
    const contentH = Math.max(80, maxY - minY);
    const pad = 48;
    const availW = Math.max(240, rect.width - pad * 2);
    const availH = Math.max(180, rect.height - pad * 2);
    const nextZoom = Math.min(1.15, Math.max(0.35, Math.min(availW / contentW, availH / contentH)));

    const centerX = minX + contentW / 2;
    const centerY = minY + contentH / 2;
    setZoom(nextZoom);
    setPan({
      x: Math.round(rect.width / 2 - centerX * nextZoom),
      y: Math.round(rect.height / 2 - centerY * nextZoom),
    });
  }, [visibleNodeList]);

  const hasInitialFitted = useRef(false);
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || hasInitialFitted.current) return;
    const tryFit = () => {
      if (hasInitialFitted.current) return;
      const rect = stage.getBoundingClientRect();
      if (rect.width > 120 && rect.height > 120) {
        hasInitialFitted.current = true;
        fitView();
      }
    };
    tryFit();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(tryFit);
    ro.observe(stage);
    return () => ro.disconnect();
  }, [fitView]);

  const addNode = useCallback(
    (parentId: string | null, customPos?: { x: number; y: number }) => {
      const id = createNodeId();
      const parent = parentId ? mindmap.nodes[parentId] : undefined;
      const siblingCount = parent ? parent.childOrder.length : 0;
      const defaultPos = customPos
        ? customPos
        : parent
        ? {
            x: parent.position.x + parent.size.width + 68,
            y: parent.position.y + siblingCount * 76,
          }
        : {
            x: Math.round((120 - pan.x) / zoom),
            y: Math.round((120 - pan.y) / zoom),
          };

      const nextNodes: Record<string, MindmapNode> = {
        ...mindmap.nodes,
        [id]: {
          id,
          parentId: parent ? parent.id : null,
          text: parent ? 'New Branch' : 'New Root Topic',
          position: defaultPos,
          size: { width: 204, height: 56 },
          accent: parent ? parent.accent : 'emerald',
          childOrder: [],
        },
      };

      if (parent) {
        nextNodes[parent.id] = {
          ...parent,
          collapsed: false,
          childOrder: [...parent.childOrder, id],
        };
      }

      commitChange({ ...mindmap, nodes: nextNodes });
      setSelectedNodeId(id);
      setSelectedEdgeId(null);
      setEditingNodeId(id);
      setEditingDraft(parent ? 'New Branch' : 'New Root Topic');
    },
    [commitChange, mindmap, pan.x, pan.y, zoom]
  );

  const deleteSelected = useCallback(() => {
    if (selectedEdgeId && mindmap.edges[selectedEdgeId]) {
      const nextEdges = { ...mindmap.edges };
      delete nextEdges[selectedEdgeId];
      commitChange({ ...mindmap, edges: nextEdges });
      setSelectedEdgeId(null);
      return;
    }

    if (!selectedNodeId || !mindmap.nodes[selectedNodeId]) return;
    const targetNode = mindmap.nodes[selectedNodeId];
    const doomed = getSubtreeIds(mindmap.nodes, selectedNodeId);
    const nextNodes: Record<string, MindmapNode> = {};
    for (const [id, n] of Object.entries(mindmap.nodes)) {
      if (doomed.has(id)) continue;
      nextNodes[id] = {
        ...n,
        childOrder: n.childOrder.filter((cid) => !doomed.has(cid)),
      };
    }

    const nextEdges: MindmapState['edges'] = {};
    for (const [eid, e] of Object.entries(mindmap.edges)) {
      if (!doomed.has(e.source) && !doomed.has(e.target)) {
        nextEdges[eid] = e;
      }
    }

    commitChange({ ...mindmap, nodes: nextNodes, edges: nextEdges });
    setSelectedNodeId(targetNode.parentId && nextNodes[targetNode.parentId] ? targetNode.parentId : getRootNodeIds(nextNodes)[0] ?? null);
  }, [commitChange, mindmap, selectedEdgeId, selectedNodeId]);

  const applyLayout = useCallback(
    (layoutMode: MindmapLayoutMode) => {
      const updatedMap: MindmapState = { ...mindmap, layout: layoutMode };
      const positions = computeAutoLayout(updatedMap, layoutMode);
      const nextNodes: Record<string, MindmapNode> = {};
      for (const [id, n] of Object.entries(mindmap.nodes)) {
        nextNodes[id] = { ...n, position: positions[id] || n.position };
      }
      commitChange({ ...updatedMap, nodes: nextNodes });
    },
    [commitChange, mindmap]
  );

  const updateNodeFields = useCallback(
    (nodeId: string, patch: Partial<MindmapNode>, recordUndo = true) => {
      const existing = mindmap.nodes[nodeId];
      if (!existing) return;
      const nextNodes: Record<string, MindmapNode> = {
        ...mindmap.nodes,
        [nodeId]: { ...existing, ...patch },
      };

      // Handle safe re-parenting when parentId changes
      if (patch.parentId !== undefined && patch.parentId !== existing.parentId) {
        if (wouldCreateCycle(mindmap.nodes, nodeId, patch.parentId)) return;
        if (existing.parentId && nextNodes[existing.parentId]) {
          nextNodes[existing.parentId] = {
            ...nextNodes[existing.parentId],
            childOrder: nextNodes[existing.parentId].childOrder.filter((cid) => cid !== nodeId),
          };
        }
        if (patch.parentId && nextNodes[patch.parentId]) {
          nextNodes[patch.parentId] = {
            ...nextNodes[patch.parentId],
            collapsed: false,
            childOrder: [...nextNodes[patch.parentId].childOrder.filter((cid) => cid !== nodeId), nodeId],
          };
        }
      }

      commitChange({ ...mindmap, nodes: nextNodes }, recordUndo);
    },
    [commitChange, mindmap]
  );

  const commitInlineEdit = () => {
    if (!editingNodeId) return;
    const trimmed = editingDraft.trim() || 'Untitled Node';
    if (mindmap.nodes[editingNodeId]?.text !== trimmed) {
      updateNodeFields(editingNodeId, { text: trimmed }, true);
    }
    setEditingNodeId(null);
  };

  // Dragging canvas/nodes via window pointer listeners
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      const active = dragRef.current;
      if (!active) return;

      if (active.kind === 'pan') {
        setPan({
          x: active.startPanX + (e.clientX - active.startX),
          y: active.startPanY + (e.clientY - active.startY),
        });
      } else if (active.kind === 'node') {
        const dx = (e.clientX - active.startX) / zoom;
        const dy = (e.clientY - active.startY) / zoom;
        if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
          active.moved = true;
        }
        let nx = active.origPos.x + dx;
        let ny = active.origPos.y + dy;
        if (snapToGrid) {
          nx = Math.round(nx / 24) * 24;
          ny = Math.round(ny / 24) * 24;
        }
        const existing = mindmap.nodes[active.nodeId];
        if (!existing) return;
        onChange({
          ...mindmap,
          nodes: {
            ...mindmap.nodes,
            [active.nodeId]: { ...existing, position: { x: Math.round(nx), y: Math.round(ny) } },
          },
        });
      }
    };

    const onMouseUp = () => {
      const active = dragRef.current;
      dragRef.current = null;
      if (active?.kind === 'node' && active.moved) {
        setHistoryPast((prev) => [...prev.slice(-39), active.snapshotBefore]);
        setHistoryFuture([]);
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [mindmap, onChange, snapToGrid, zoom]);

  const handleStageWheel = (e: React.WheelEvent) => {
    const stage = stageRef.current;
    if (!stage) return;
    e.preventDefault();
    const rect = stage.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const factor = e.deltaY < 0 ? 1.08 : 0.92;
    const nextZoom = Math.min(2.4, Math.max(0.28, Number((zoom * factor).toFixed(3))));
    const wx = (mx - pan.x) / zoom;
    const wy = (my - pan.y) / zoom;
    setZoom(nextZoom);
    setPan({
      x: Math.round(mx - wx * nextZoom),
      y: Math.round(my - wy * nextZoom),
    });
  };

  const handleCanvasKeyDown = (e: React.KeyboardEvent) => {
    const target = e.target as HTMLElement | null;
    if (editingNodeId || target?.closest('input, textarea, select')) return;

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      e.stopPropagation();
      if (e.shiftKey) handleRedo();
      else handleUndo();
      return;
    }

    if (e.key === 'Tab' && selectedNodeId) {
      e.preventDefault();
      addNode(selectedNodeId);
    } else if (e.key === 'Enter' && selectedNode) {
      e.preventDefault();
      addNode(selectedNode.parentId);
    } else if (e.key === 'F2' && selectedNode) {
      e.preventDefault();
      setEditingNodeId(selectedNode.id);
      setEditingDraft(selectedNode.text);
    } else if ((e.key === 'Delete' || e.key === 'Backspace') && (selectedNodeId || selectedEdgeId)) {
      e.preventDefault();
      deleteSelected();
    }
  };

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const parentCandidates = useMemo(() => {
    if (!selectedNode) return [];
    const options: Array<{ value: string; label: string }> = [{ value: '__root__', label: '(Root Level Node)' }];
    for (const candidate of Object.values(mindmap.nodes)) {
      if (candidate.id === selectedNode.id) continue;
      if (wouldCreateCycle(mindmap.nodes, selectedNode.id, candidate.id)) continue;
      options.push({ value: candidate.id, label: candidate.text || candidate.id });
    }
    return options;
  }, [mindmap.nodes, selectedNode]);

  // Minimap bounds
  const minimapBounds = useMemo(() => {
    if (visibleNodeList.length === 0) return { minX: 0, minY: 0, width: 1000, height: 600 };
    const minX = Math.min(...visibleNodeList.map((n) => n.position.x)) - 40;
    const minY = Math.min(...visibleNodeList.map((n) => n.position.y)) - 40;
    const maxX = Math.max(...visibleNodeList.map((n) => n.position.x + n.size.width)) + 40;
    const maxY = Math.max(...visibleNodeList.map((n) => n.position.y + n.size.height)) + 40;
    return {
      minX,
      minY,
      width: Math.max(200, maxX - minX),
      height: Math.max(140, maxY - minY),
    };
  }, [visibleNodeList]);

  return (
    <div className={styles.mindmapRoot} tabIndex={0} onKeyDown={handleCanvasKeyDown}>
      {/* Mindmap Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.toolGroup}>
          <button
            type="button"
            className={`${styles.toolBtn} ${tool === 'select' ? styles.toolBtnActive : ''}`}
            onClick={() => {
              setTool('select');
              setConnectSourceId(null);
            }}
            title="Select & Move Nodes"
          >
            <MousePointer size={13} /> Select
          </button>
          <button
            type="button"
            className={`${styles.toolBtn} ${tool === 'pan' ? styles.toolBtnActive : ''}`}
            onClick={() => {
              setTool('pan');
              setConnectSourceId(null);
            }}
            title="Pan Canvas"
          >
            <Hand size={13} /> Pan
          </button>
          <button
            type="button"
            className={`${styles.toolBtn} ${tool === 'connect' ? styles.toolBtnActive : ''}`}
            onClick={() => {
              setTool((t) => (t === 'connect' ? 'select' : 'connect'));
              setConnectSourceId(null);
            }}
            title="Connect two nodes with a dashed cross-link"
          >
            <Link2 size={13} /> Link
          </button>

          <span className={styles.divider} />

          <button
            type="button"
            className={styles.toolBtn}
            onClick={() => addNode(selectedNodeId)}
            title="Add child node (Tab)"
          >
            <GitBranch size={13} /> + Branch
          </button>
          <button
            type="button"
            className={styles.toolBtn}
            onClick={() => addNode(null)}
            title="Add independent root topic"
          >
            <Plus size={13} /> + Root
          </button>
          <button
            type="button"
            className={styles.toolBtn}
            onClick={deleteSelected}
            disabled={!selectedNodeId && !selectedEdgeId}
            title="Delete selected node or link (Del)"
          >
            <Trash2 size={13} />
          </button>

          <span className={styles.divider} />

          <button
            type="button"
            className={styles.toolBtn}
            onClick={handleUndo}
            disabled={historyPast.length === 0}
            title="Undo (Ctrl+Z)"
            aria-label="Undo mindmap change"
          >
            <Undo2 size={13} />
          </button>
          <button
            type="button"
            className={styles.toolBtn}
            onClick={handleRedo}
            disabled={historyFuture.length === 0}
            title="Redo (Ctrl+Shift+Z)"
            aria-label="Redo mindmap change"
          >
            <Redo2 size={13} />
          </button>
        </div>

        <div className={styles.toolGroup}>
          <div style={{ minWidth: '175px' }}>
            <CustomSelect<MindmapLayoutMode>
              value={mindmap.layout}
              onChange={(mode) => applyLayout(mode)}
              options={LAYOUT_OPTIONS}
              ariaLabel="Mindmap layout mode"
            />
          </div>
          <button
            type="button"
            className={styles.toolBtn}
            onClick={() => applyLayout(mindmap.layout)}
            title="Re-run Auto Layout cleanly"
          >
            <LayoutGrid size={13} /> Auto-Layout
          </button>
          <button
            type="button"
            className={`${styles.toolBtn} ${snapToGrid ? styles.toolBtnActive : ''}`}
            onClick={() => {
              setSnapToGrid((s) => !s);
              setShowGrid(true);
            }}
            title="Toggle Grid & Snap"
          >
            <Grid size={13} /> Snap
          </button>
          <button
            type="button"
            className={styles.toolBtn}
            onClick={() => setZoom((z) => Math.max(0.3, Number((z - 0.15).toFixed(2))))}
            title="Zoom Out"
            aria-label="Zoom out"
          >
            <ZoomOut size={13} />
          </button>
          <button
            type="button"
            className={styles.toolBtn}
            onClick={fitView}
            title="Fit Mindmap to View"
          >
            <Maximize2 size={12} /> {Math.round(zoom * 100)}%
          </button>
          <button
            type="button"
            className={styles.toolBtn}
            onClick={() => setZoom((z) => Math.min(2.2, Number((z + 0.15).toFixed(2))))}
            title="Zoom In"
            aria-label="Zoom in"
          >
            <ZoomIn size={13} />
          </button>
          <button
            type="button"
            className={`${styles.toolBtn} ${showInspector ? styles.toolBtnActive : ''}`}
            onClick={() => setShowInspector((prev) => !prev)}
            title="Toggle Node Inspector"
          >
            <PanelRight size={13} />
          </button>
        </div>
      </div>

      {/* Main Canvas + Inspector */}
      <div className={styles.workspaceRow}>
        <div
          ref={stageRef}
          className={`${styles.stage} ${showGrid ? styles.stageGrid : ''} ${
            tool === 'pan' ? styles.stagePanning : ''
          } ${tool === 'connect' ? styles.stageConnecting : ''}`}
          onWheel={handleStageWheel}
          onMouseDown={(e) => {
            if (e.target !== stageRef.current && !(e.target as HTMLElement)?.closest('[data-stage-bg="true"]')) {
              return;
            }
            if (e.button === 1 || tool === 'pan' || e.button === 0) {
              dragRef.current = {
                kind: 'pan',
                startX: e.clientX,
                startY: e.clientY,
                startPanX: pan.x,
                startPanY: pan.y,
              };
            }
            setSelectedEdgeId(null);
            if (tool !== 'connect') setConnectSourceId(null);
          }}
          onDoubleClick={(e) => {
            if (e.target !== stageRef.current || !stageRef.current) return;
            const rect = stageRef.current.getBoundingClientRect();
            const wx = Math.round((e.clientX - rect.left - pan.x) / zoom);
            const wy = Math.round((e.clientY - rect.top - pan.y) / zoom);
            addNode(null, { x: wx - 102, y: wy - 28 });
          }}
        >
          <div
            className={styles.world}
            style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
          >
            <svg className={styles.edgeSvg} viewBox="-4000 -4000 8000 8000">
              <defs>
                <marker
                  id="notemap-arrow"
                  viewBox="0 0 10 10"
                  refX="8"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1 L 10 5 L 0 9 z" fill="#38bdf8" />
                </marker>
              </defs>

              {/* Hierarchy Edges */}
              {visibleNodeList.map((node) => {
                if (!node.parentId || !visibleIds.has(node.parentId)) return null;
                const parent = mindmap.nodes[node.parentId];
                if (!parent) return null;
                const { path } = buildEdgePath(parent, node);
                const stroke = NODE_ACCENT_COLORS[node.accent]?.border || '#475569';
                return (
                  <path
                    key={`h_${parent.id}_${node.id}`}
                    d={path}
                    fill="none"
                    stroke={stroke}
                    strokeOpacity={0.72}
                    strokeWidth={2}
                  />
                );
              })}

              {/* Explicit Cross-Link Edges */}
              {Object.values(mindmap.edges).map((edge) => {
                if (!visibleIds.has(edge.source) || !visibleIds.has(edge.target)) return null;
                const s = mindmap.nodes[edge.source];
                const t = mindmap.nodes[edge.target];
                if (!s || !t) return null;
                const { path, midX, midY } = buildEdgePath(s, t);
                const isEdgeSelected = selectedEdgeId === edge.id;
                return (
                  <g key={edge.id}>
                    <path
                      d={path}
                      fill="none"
                      stroke="transparent"
                      strokeWidth={12}
                      className={styles.edgeClickable}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedEdgeId(edge.id);
                        setSelectedNodeId(null);
                      }}
                    />
                    <path
                      d={path}
                      fill="none"
                      stroke={isEdgeSelected ? '#10b981' : '#38bdf8'}
                      strokeWidth={isEdgeSelected ? 2.6 : 1.9}
                      strokeDasharray={edge.dashed !== false ? '6 4' : undefined}
                      markerEnd="url(#notemap-arrow)"
                    />
                    {edge.label && (
                      <g>
                        <rect
                          x={midX - Math.max(36, edge.label.length * 3.8 + 10)}
                          y={midY - 12}
                          width={Math.max(72, edge.label.length * 7.6 + 20)}
                          height={22}
                          rx={6}
                          fill="#090d16"
                          stroke="#38bdf8"
                          strokeOpacity={0.55}
                          strokeWidth={1}
                        />
                        <text
                          x={midX}
                          y={midY + 3}
                          fill="#7dd3fc"
                          fontSize="11"
                          fontWeight="600"
                          textAnchor="middle"
                        >
                          {edge.label}
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}
            </svg>

            {/* Visible Nodes */}
            {visibleNodeList.map((node) => {
              const palette = NODE_ACCENT_COLORS[node.accent] || NODE_ACCENT_COLORS.slate;
              const isSelected = selectedNodeId === node.id;
              const isConnectSource = connectSourceId === node.id;
              const isEditing = editingNodeId === node.id;
              const descendantCount = countDescendants(mindmap.nodes, node.id);
              const isMatch =
                normalizedQuery.length > 0 &&
                (node.text.toLowerCase().includes(normalizedQuery) ||
                  (node.notes || '').toLowerCase().includes(normalizedQuery) ||
                  (node.tag || '').toLowerCase().includes(normalizedQuery));

              return (
                <div
                  key={node.id}
                  data-node-id={node.id}
                  className={`${styles.nodeCard} ${isSelected ? styles.nodeCardSelected : ''} ${
                    isConnectSource ? styles.nodeCardConnectSource : ''
                  } ${isMatch ? styles.nodeCardMatch : ''}`}
                  style={{
                    left: node.position.x,
                    top: node.position.y,
                    width: node.size.width,
                    minHeight: node.size.height,
                    background: palette.bg,
                    borderColor: palette.border,
                    color: palette.text,
                  }}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    if (tool === 'connect') {
                      if (!connectSourceId) {
                        setConnectSourceId(node.id);
                        setSelectedNodeId(node.id);
                      } else if (connectSourceId !== node.id) {
                        const eid = createEdgeId();
                        commitChange({
                          ...mindmap,
                          edges: {
                            ...mindmap.edges,
                            [eid]: {
                              id: eid,
                              source: connectSourceId,
                              target: node.id,
                              dashed: true,
                            },
                          },
                        });
                        setConnectSourceId(null);
                        setTool('select');
                        setSelectedEdgeId(eid);
                      }
                      return;
                    }

                    setSelectedNodeId(node.id);
                    setSelectedEdgeId(null);
                    if (e.button === 0 && !isEditing && tool === 'select') {
                      dragRef.current = {
                        kind: 'node',
                        nodeId: node.id,
                        startX: e.clientX,
                        startY: e.clientY,
                        origPos: { ...node.position },
                        snapshotBefore: mindmap,
                        moved: false,
                      };
                    }
                  }}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    setEditingNodeId(node.id);
                    setEditingDraft(node.text);
                  }}
                >
                  {node.tag && (
                    <div className={styles.nodeHeaderRow}>
                      <span className={styles.nodeTag} style={{ color: palette.badge }}>
                        {node.tag}
                      </span>
                    </div>
                  )}

                  {isEditing ? (
                    <textarea
                      autoFocus
                      rows={2}
                      className={styles.nodeInlineInput}
                      value={editingDraft}
                      onChange={(e) => setEditingDraft(e.target.value)}
                      onBlur={commitInlineEdit}
                      onKeyDown={(e) => {
                        e.stopPropagation();
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          commitInlineEdit();
                        } else if (e.key === 'Escape') {
                          e.preventDefault();
                          setEditingNodeId(null);
                        }
                      }}
                    />
                  ) : (
                    <div className={styles.nodeTitle}>{node.text || 'Untitled Node'}</div>
                  )}

                  {descendantCount > 0 && (
                    <button
                      type="button"
                      className={styles.collapseBtn}
                      title={node.collapsed ? `Expand ${descendantCount} child nodes` : 'Collapse branch'}
                      aria-label={node.collapsed ? 'Expand branch' : 'Collapse branch'}
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        updateNodeFields(node.id, { collapsed: !node.collapsed }, false);
                      }}
                    >
                      {node.collapsed ? (
                        `+${descendantCount}`
                      ) : (
                        <Minus size={11} />
                      )}
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Minimap */}
          <div className={styles.minimap} aria-hidden="true">
            <svg
              width="148"
              height="92"
              viewBox={`${minimapBounds.minX} ${minimapBounds.minY} ${minimapBounds.width} ${minimapBounds.height}`}
            >
              {visibleNodeList.map((n) => (
                <rect
                  key={n.id}
                  x={n.position.x}
                  y={n.position.y}
                  width={n.size.width}
                  height={n.size.height}
                  rx="16"
                  fill={NODE_ACCENT_COLORS[n.accent]?.border || '#475569'}
                  fillOpacity={selectedNodeId === n.id ? 1 : 0.72}
                />
              ))}
            </svg>
          </div>

          <div className={styles.statusHint}>
            {tool === 'connect'
              ? connectSourceId
                ? 'Click destination node to create cross-link'
                : 'Click source node to start cross-link'
              : 'Double-click node to rename · Tab add child · Double-click blank canvas to add root'}
          </div>
        </div>

        {/* Right Node / Edge Inspector */}
        {showInspector && (
          <aside className={styles.inspector} aria-label="Mindmap node inspector">
            <div className={styles.inspectorHeading}>
              <span>{selectedNode ? 'Node Properties' : selectedEdgeId ? 'Cross-Link' : 'Canvas Summary'}</span>
              {selectedNode && onSendToAI && (
                <button
                  type="button"
                  className={styles.toolBtn}
                  onClick={() =>
                    onSendToAI(
                      `Analyze this security mindmap node and suggest concrete attack paths / test cases:\n\n**Node:** ${selectedNode.text}\n${
                        selectedNode.tag ? `**Tag:** ${selectedNode.tag}\n` : ''
                      }${selectedNode.notes ? `**Notes:** ${selectedNode.notes}` : ''}`
                    )
                  }
                  title="Send selected node to Copilot"
                >
                  <Sparkles size={12} color="#10b981" /> Ask AI
                </button>
              )}
            </div>

            {selectedNode ? (
              <>
                <div>
                  <label className={styles.fieldLabel}>Label</label>
                  <input
                    className={styles.fieldInput}
                    value={selectedNode.text}
                    onChange={(e) => updateNodeFields(selectedNode.id, { text: e.target.value }, false)}
                  />
                </div>

                <div>
                  <label className={styles.fieldLabel}>Security Tag</label>
                  <input
                    className={styles.fieldInput}
                    placeholder="e.g. Recon, Critical, Pivot, Scope..."
                    value={selectedNode.tag || ''}
                    onChange={(e) => updateNodeFields(selectedNode.id, { tag: e.target.value }, false)}
                  />
                </div>

                <div>
                  <label className={styles.fieldLabel}>Parent Branch</label>
                  <CustomSelect
                    value={selectedNode.parentId || '__root__'}
                    onChange={(val) =>
                      updateNodeFields(
                        selectedNode.id,
                        { parentId: val === '__root__' ? null : val },
                        true
                      )
                    }
                    options={parentCandidates}
                    ariaLabel="Parent branch"
                  />
                </div>

                <div>
                  <label className={styles.fieldLabel}>Color Accent</label>
                  <div className={styles.swatchRow}>
                    {ACCENT_OPTIONS.map((acc) => (
                      <button
                        key={acc}
                        type="button"
                        aria-label={`Set color ${acc}`}
                        className={`${styles.swatch} ${
                          selectedNode.accent === acc ? styles.swatchActive : ''
                        }`}
                        style={{ background: NODE_ACCENT_COLORS[acc].border }}
                        onClick={() => updateNodeFields(selectedNode.id, { accent: acc }, true)}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <label className={styles.fieldLabel}>Technical Notes / Payloads</label>
                  <textarea
                    className={styles.fieldTextarea}
                    placeholder="Endpoints, headers, hypotheses, CVEs..."
                    value={selectedNode.notes || ''}
                    onChange={(e) => updateNodeFields(selectedNode.id, { notes: e.target.value }, false)}
                  />
                </div>

                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className={styles.toolBtn}
                    onClick={() => addNode(selectedNode.id)}
                  >
                    <ChevronRight size={13} /> Add Child
                  </button>
                  <button
                    type="button"
                    className={styles.toolBtn}
                    onClick={deleteSelected}
                    style={{ color: '#fca5a5' }}
                  >
                    <Trash2 size={13} /> Delete
                  </button>
                </div>
              </>
            ) : selectedEdgeId && mindmap.edges[selectedEdgeId] ? (
              <>
                <div>
                  <label className={styles.fieldLabel}>Cross-Link Label</label>
                  <input
                    className={styles.fieldInput}
                    placeholder="e.g. leaks token to..."
                    value={mindmap.edges[selectedEdgeId].label || ''}
                    onChange={(e) => {
                      const edge = mindmap.edges[selectedEdgeId];
                      onChange({
                        ...mindmap,
                        edges: {
                          ...mindmap.edges,
                          [selectedEdgeId]: { ...edge, label: e.target.value },
                        },
                      });
                    }}
                  />
                </div>
                <button
                  type="button"
                  className={styles.toolBtn}
                  onClick={deleteSelected}
                  style={{ color: '#fca5a5' }}
                >
                  <Trash2 size={13} /> Remove Cross-Link
                </button>
              </>
            ) : (
              <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Click any node to inspect or attach technical notes, color tags, and cross-links.
                <br />
                <br />
                Nodes: <strong>{Object.keys(mindmap.nodes).length}</strong>
                <br />
                Cross-links: <strong>{Object.keys(mindmap.edges).length}</strong>
              </p>
            )}
          </aside>
        )}
      </div>
    </div>
  );
}
