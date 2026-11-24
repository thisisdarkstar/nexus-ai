import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Share2,
  PlusCircle,
  Sparkles,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Maximize2,
} from 'lucide-react';
import { getActiveProjectId } from '../../core/storage/projectStorage';
import { AssetGraph } from '../../domain/graph/AssetGraph';
import type { GraphNode, GraphEdge, AssetNodeType } from '../../domain/graph/types';
import { prioritizationEngine } from '../../domain/prioritization/PrioritizationEngine';
import { storageManager } from '../../core/storage/StorageManager';
import { eventBus } from '../../core/bus/EventBus';
import { useToast } from '../../lib/toast';
import CustomSelect from '../common/CustomSelect';
import type { ReconAsset, ScopeItem, SecurityTab } from '../../types';
import styles from './AssetGraphViewer.module.css';

interface AssetGraphViewerProps {
  onSendToAI?: (prompt: string) => void;
  onTabChange?: (tab: SecurityTab) => void;
}

interface SimNode extends GraphNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

const NODE_COLORS: Record<AssetNodeType, string> = {
  domain: '#a855f7',
  subdomain: '#3b82f6',
  http_endpoint: '#10b981',
  parameter: '#eab308',
  technology: '#f97316',
  source_file: '#6366f1',
  ip_address: '#06b6d4',
  port_service: '#8b5cf6',
  finding: '#ef4444',
};

const FILTER_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'ALL', label: 'All Node Entities' },
  { value: 'domain', label: 'Domains' },
  { value: 'subdomain', label: 'Subdomains' },
  { value: 'http_endpoint', label: 'HTTP Endpoints' },
  { value: 'parameter', label: 'Parameters' },
  { value: 'technology', label: 'Technologies' },
  { value: 'finding', label: 'Findings' },
];

export default function AssetGraphViewer({ onSendToAI }: AssetGraphViewerProps) {
  const { toast } = useToast();
  const projectId = getActiveProjectId();
  const [graph] = useState<AssetGraph>(() => new AssetGraph(projectId));
  const [nodes, setNodes] = useState<SimNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [canvasDimensions, setCanvasDimensions] = useState<{ width: number; height: number }>({
    width: 800,
    height: 520,
  });

  const panOffset = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const zoomScale = useRef<number>(1);
  const isDragging = useRef<boolean>(false);
  const dragStart = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const draggedNode = useRef<SimNode | null>(null);
  const alphaRef = useRef<number>(1.0);
  const animFrameRef = useRef<number | null>(null);

  // ResizeObserver for dynamic canvas sizing
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateSize = () => {
      const rect = container.getBoundingClientRect();
      if (rect.width > 50 && rect.height > 50) {
        setCanvasDimensions({
          width: Math.floor(rect.width),
          height: Math.floor(rect.height),
        });
      }
    };

    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  // Initialize and populate graph data
  const loadGraphData = useCallback(async () => {
    let assets: ReconAsset[] = [];
    let scopeRules: ScopeItem[] = [];

    try {
      const storedAssets = await storageManager.getAssets(projectId);
      if (storedAssets && storedAssets.length > 0) {
        assets = storedAssets as unknown as ReconAsset[];
      } else {
        // Fallback demo surface if storage is empty
        assets = [
          {
            id: 'a1',
            url: 'https://api.acme.corp/v1/auth/login?redirect=/dashboard&scope=admin',
            host: 'api.acme.corp',
            technologies: ['Node.js', 'Express', 'JWT'],
            riskScore: 'high',
            statusCode: 200,
          },
          {
            id: 'a2',
            url: 'https://api.acme.corp/actuator/env',
            host: 'api.acme.corp',
            technologies: ['Spring Boot Actuator', 'Java'],
            riskScore: 'critical',
            statusCode: 200,
          },
          {
            id: 'a3',
            url: 'https://staging.acme.corp/users/{id}',
            host: 'staging.acme.corp',
            technologies: ['PostgreSQL', 'Python'],
            riskScore: 'medium',
            statusCode: 200,
          },
        ];
      }

      const storedScope = await storageManager.getScope(projectId);
      if (storedScope && storedScope.length > 0) {
        scopeRules = storedScope;
      }
    } catch {
      // ignore
    }

    graph.clear();
    graph.buildFromFlatAssets(assets, projectId, scopeRules);

    const rawNodes = graph.getAllNodes();
    const rawEdges = graph.getAllEdges();

    const cx = canvasDimensions.width / 2;
    const cy = canvasDimensions.height / 2;

    // Distribute nodes in concentric rings by entity type
    const simNodes: SimNode[] = rawNodes.map((n, i) => {
      let baseRadius = 80;
      if (n.type === 'domain') baseRadius = 20;
      else if (n.type === 'subdomain') baseRadius = 110;
      else if (n.type === 'http_endpoint') baseRadius = 180;
      else if (n.type === 'parameter') baseRadius = 240;
      else if (n.type === 'technology') baseRadius = 150;
      else if (n.type === 'finding') baseRadius = 210;

      const angle = (i / Math.max(1, rawNodes.length)) * 2 * Math.PI + (Math.random() - 0.5) * 0.4;
      const radius = baseRadius + (Math.random() - 0.5) * 30;

      return {
        ...n,
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius,
        vx: 0,
        vy: 0,
      };
    });

    alphaRef.current = 1.0;
    setNodes(simNodes);
    setEdges(rawEdges);
    setSelectedNodeId(simNodes[0]?.id || null);
  }, [graph, canvasDimensions.width, canvasDimensions.height, projectId]);

  useEffect(() => {
    loadGraphData();
  }, [loadGraphData]);

  // Stable Force-Directed Simulation Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || nodes.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let running = true;
    const nodeMap = new Map<string, SimNode>(nodes.map((n) => [n.id, n]));

    const render = () => {
      if (!running) return;

      const width = canvas.width;
      const height = canvas.height;
      const cx = width / 2;
      const cy = height / 2;

      // Cool down alpha
      const alpha = alphaRef.current;
      if (alpha > 0.015) {
        alphaRef.current *= 0.985;
      }

      // 1. Spring attraction along edges (Hooke's Law with unit vector)
      for (const edge of edges) {
        const src = nodeMap.get(edge.sourceId);
        const tgt = nodeMap.get(edge.targetId);
        if (src && tgt) {
          let dx = tgt.x - src.x;
          let dy = tgt.y - src.y;
          let dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 0.1) {
            dx = 0.1;
            dist = 0.1;
          }

          const targetDist = 75;
          const displacement = dist - targetDist;
          const force = displacement * 0.04 * alpha;
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;

          if (src !== draggedNode.current) {
            src.vx += fx;
            src.vy += fy;
          }
          if (tgt !== draggedNode.current) {
            tgt.vx -= fx;
            tgt.vy -= fy;
          }
        }
      }

      // 2. Node Repulsion (Coulomb's Law with soft distance epsilon)
      for (let i = 0; i < nodes.length; i++) {
        const n1 = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const n2 = nodes[j];
          let dx = n2.x - n1.x;
          let dy = n2.y - n1.y;
          let distSq = dx * dx + dy * dy;
          if (distSq < 1) {
            dx = (Math.random() - 0.5) * 2;
            dy = (Math.random() - 0.5) * 2;
            distSq = 1;
          }

          if (distSq < 40000) {
            const dist = Math.sqrt(distSq);
            const force = (700 / (distSq + 80)) * alpha;
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;

            if (n1 !== draggedNode.current) {
              n1.vx -= fx;
              n1.vy -= fy;
            }
            if (n2 !== draggedNode.current) {
              n2.vx += fx;
              n2.vy += fy;
            }
          }
        }
      }

      // 3. Center gravity, velocity clamping, position updates & NaN protection
      const margin = 20;
      for (const n of nodes) {
        if (n !== draggedNode.current) {
          n.vx += (cx - n.x) * 0.015 * alpha;
          n.vy += (cy - n.y) * 0.015 * alpha;

          // Clamp velocity to prevent sudden bursts
          n.vx = Math.max(-8, Math.min(8, n.vx)) * 0.86;
          n.vy = Math.max(-8, Math.min(8, n.vy)) * 0.86;

          n.x += n.vx;
          n.y += n.vy;

          // NaN & infinite guard
          if (isNaN(n.x) || !isFinite(n.x)) n.x = cx + (Math.random() - 0.5) * 40;
          if (isNaN(n.y) || !isFinite(n.y)) n.y = cy + (Math.random() - 0.5) * 40;
          if (isNaN(n.vx)) n.vx = 0;
          if (isNaN(n.vy)) n.vy = 0;

          // Keep within reasonable canvas boundary
          n.x = Math.max(margin, Math.min(width - margin, n.x));
          n.y = Math.max(margin, Math.min(height - margin, n.y));
        }
      }

      // 4. Render Canvas Frame
      ctx.clearRect(0, 0, width, height);
      ctx.save();
      ctx.translate(panOffset.current.x, panOffset.current.y);
      ctx.scale(zoomScale.current, zoomScale.current);

      const q = searchQuery.toLowerCase().trim();

      // Render Edges
      for (const edge of edges) {
        const src = nodeMap.get(edge.sourceId);
        const tgt = nodeMap.get(edge.targetId);
        if (src && tgt) {
          const isConnectedToSelected =
            selectedNodeId && (src.id === selectedNodeId || tgt.id === selectedNodeId);

          ctx.beginPath();
          ctx.moveTo(src.x, src.y);
          ctx.lineTo(tgt.x, tgt.y);

          if (isConnectedToSelected) {
            ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
            ctx.lineWidth = 1.5;
          } else {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
            ctx.lineWidth = 1;
          }
          ctx.stroke();
        }
      }

      // Render Nodes
      for (const node of nodes) {
        const isSelected = node.id === selectedNodeId;
        const color = NODE_COLORS[node.type] || '#38bdf8';

        const matchesSearch = !q || node.label.toLowerCase().includes(q) || node.type.includes(q);
        const matchesFilter = filterType === 'ALL' || node.type === filterType;
        const isDimmed = !matchesSearch || !matchesFilter;

        const radius = node.type === 'domain' ? 9 : node.type === 'subdomain' ? 7 : 5;

        // Outer halo on selected or search match
        if (isSelected || (q && matchesSearch)) {
          ctx.beginPath();
          ctx.arc(node.x, node.y, radius + 6, 0, 2 * Math.PI);
          ctx.fillStyle = isSelected ? `${color}40` : 'rgba(56, 189, 248, 0.25)';
          ctx.fill();
        }

        // Main node circle
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);
        ctx.fillStyle = isDimmed ? `${color}30` : color;
        ctx.fill();
        ctx.strokeStyle = isSelected ? '#ffffff' : isDimmed ? 'rgba(0,0,0,0.2)' : 'rgba(0, 0, 0, 0.6)';
        ctx.lineWidth = isSelected ? 2 : 1;
        ctx.stroke();

        // Label text
        ctx.font = isSelected ? '600 11px monospace' : '10px monospace';
        ctx.fillStyle = isSelected ? '#ffffff' : isDimmed ? '#475569' : '#94a3b8';

        const labelText = node.label.length > 22 ? `${node.label.slice(0, 20)}…` : node.label;
        ctx.fillText(labelText, node.x + radius + 3, node.y + 3);
      }

      ctx.restore();
      animFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      running = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [nodes, edges, selectedNodeId, searchQuery, filterType, canvasDimensions.width, canvasDimensions.height]);

  // Pointer interactions with coordinate scaling
  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const canvasX = (e.clientX - rect.left) * scaleX;
    const canvasY = (e.clientY - rect.top) * scaleY;

    return {
      x: (canvasX - panOffset.current.x) / zoomScale.current,
      y: (canvasY - panOffset.current.y) / zoomScale.current,
    };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getCanvasCoords(e);

    // Hit test nodes
    for (const n of nodes) {
      const dx = n.x - coords.x;
      const dy = n.y - coords.y;
      const hitRadius = n.type === 'domain' ? 12 : 9;
      if (dx * dx + dy * dy < hitRadius * hitRadius) {
        draggedNode.current = n;
        setSelectedNodeId(n.id);
        alphaRef.current = 0.3; // Wake simulation for smooth reaction
        return;
      }
    }

    // Otherwise pan canvas
    isDragging.current = true;
    dragStart.current = {
      x: e.clientX - panOffset.current.x,
      y: e.clientY - panOffset.current.y,
    };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (draggedNode.current) {
      const coords = getCanvasCoords(e);
      draggedNode.current.x = coords.x;
      draggedNode.current.y = coords.y;
      draggedNode.current.vx = 0;
      draggedNode.current.vy = 0;
      alphaRef.current = 0.25;
      return;
    }

    if (isDragging.current) {
      panOffset.current = {
        x: e.clientX - dragStart.current.x,
        y: e.clientY - dragStart.current.y,
      };
    }
  };

  const handleMouseUp = () => {
    draggedNode.current = null;
    isDragging.current = false;
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.08 : 0.92;
    const newZoom = Math.max(0.3, Math.min(3, zoomScale.current * factor));
    zoomScale.current = newZoom;
  };

  const handleZoom = (direction: 'in' | 'out' | 'reset') => {
    if (direction === 'in') {
      zoomScale.current = Math.min(3, zoomScale.current * 1.2);
    } else if (direction === 'out') {
      zoomScale.current = Math.max(0.3, zoomScale.current / 1.2);
    } else {
      zoomScale.current = 1.0;
      panOffset.current = { x: 0, y: 0 };
    }
  };

  const selectedNode = useMemo(() => {
    return nodes.find((n) => n.id === selectedNodeId) || nodes[0] || null;
  }, [nodes, selectedNodeId]);

  const prioritizedInfo = useMemo(() => {
    if (!selectedNode) return null;
    return prioritizationEngine.prioritizeEndpoint(selectedNode);
  }, [selectedNode]);

  const connectedEdges = useMemo(() => {
    if (!selectedNode) return [];
    return edges.filter((e) => e.sourceId === selectedNode.id || e.targetId === selectedNode.id);
  }, [selectedNode, edges]);

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.titleArea}>
          <Share2 size={24} className={styles.titleIcon} />
          <div>
            <h2 className={styles.title}>Relational Attack Surface Graph</h2>
            <p className={styles.subtitle}>
              Interactive entity-relationship graph connecting domains, endpoints, parameters, and technologies
            </p>
          </div>
        </div>

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.btn}
            onClick={loadGraphData}
            title="Reload attack surface graph from IndexedDB"
          >
            <RotateCcw size={13} /> Re-Sync
          </button>
          {onSendToAI && selectedNode && (
            <button
              type="button"
              className={styles.btn}
              onClick={() => {
                onSendToAI(
                  `As an Application Security Architect, evaluate this node in the Attack Surface Graph:\n\nType: ${selectedNode.type}\nLabel: ${selectedNode.label}\nRisk Score: ${prioritizedInfo?.compositeScore || 'N/A'}/100\nPriority: ${prioritizedInfo?.priorityLevel.toUpperCase() || 'N/A'}\n\nRationales:\n${prioritizedInfo?.rationales.map((r) => `- ${r}`).join('\n')}\n\nPlease provide a targeted defensive assessment plan.`
                );
              }}
            >
              <Sparkles size={13} color="#38bdf8" /> AI Node Review
            </button>
          )}
        </div>
      </div>

      {/* Toolbar */}
      <div className={styles.toolbar}>
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            className={styles.searchBox}
            placeholder="Search graph nodes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <CustomSelect
            value={filterType}
            onChange={(val) => setFilterType(val)}
            options={FILTER_OPTIONS}
            style={{ minWidth: '170px' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', fontSize: '0.78rem', color: '#94a3b8' }}>
          <span>{nodes.length} Nodes</span>
          <span>•</span>
          <span>{edges.length} Edges</span>
        </div>
      </div>

      {/* Graph Canvas & Side Inspector */}
      <div className={styles.graphLayout}>
        <div ref={containerRef} className={styles.canvasContainer}>
          <canvas
            ref={canvasRef}
            width={canvasDimensions.width}
            height={canvasDimensions.height}
            className={styles.canvas}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onWheel={handleWheel}
          />

          {/* Zoom & Pan Overlay Controls */}
          <div className={styles.zoomControls}>
            <button
              type="button"
              className={styles.zoomBtn}
              onClick={() => handleZoom('in')}
              title="Zoom In"
            >
              <ZoomIn size={14} />
            </button>
            <button
              type="button"
              className={styles.zoomBtn}
              onClick={() => handleZoom('out')}
              title="Zoom Out"
            >
              <ZoomOut size={14} />
            </button>
            <button
              type="button"
              className={styles.zoomBtn}
              onClick={() => handleZoom('reset')}
              title="Reset View"
            >
              <Maximize2 size={13} />
            </button>
          </div>

          {/* Legend */}
          <div className={styles.legendBar}>
            {Object.entries(NODE_COLORS).map(([type, color]) => (
              <span key={type}>
                <span className={styles.legendDot} style={{ background: color }} />
                {type.replace('_', ' ')}
              </span>
            ))}
          </div>
        </div>

        {/* Node Inspector Panel */}
        {selectedNode ? (
          <div className={styles.inspectorPanel}>
            <div className={styles.inspectorHeader}>
              <span
                className={styles.nodeTypeBadge}
                style={{
                  background: `${NODE_COLORS[selectedNode.type]}20`,
                  color: NODE_COLORS[selectedNode.type],
                  border: `1px solid ${NODE_COLORS[selectedNode.type]}40`,
                }}
              >
                {selectedNode.type.toUpperCase()}
              </span>
              <span className={styles.nodeLabel}>{selectedNode.label}</span>
            </div>

            {/* Prioritization Score */}
            {prioritizedInfo && (
              <div className={styles.riskBanner}>
                <span>Composite Priority:</span>
                <span
                  style={{
                    fontWeight: 700,
                    color:
                      prioritizedInfo.priorityLevel === 'critical'
                        ? '#ef4444'
                        : prioritizedInfo.priorityLevel === 'high'
                          ? '#f97316'
                          : '#10b981',
                  }}
                >
                  {prioritizedInfo.compositeScore}/100 ({prioritizedInfo.priorityLevel.toUpperCase()})
                </span>
              </div>
            )}

            {/* Rationales */}
            {prioritizedInfo && prioritizedInfo.rationales.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' }}>
                  Risk Rationale Breakdown:
                </span>
                {prioritizedInfo.rationales.map((r, i) => (
                  <div key={i} style={{ fontSize: '0.74rem', color: '#cbd5e1', background: 'rgba(255,255,255,0.03)', padding: '0.3rem 0.5rem', borderRadius: '4px' }}>
                    {r}
                  </div>
                ))}
              </div>
            )}

            {/* Connected Edges */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' }}>
                Connected Relationships ({connectedEdges.length}):
              </span>
              <div className={styles.edgeList}>
                {connectedEdges.length === 0 ? (
                  <div style={{ fontSize: '0.74rem', color: '#64748b', fontStyle: 'italic', padding: '0.4rem' }}>
                    No adjacent connections
                  </div>
                ) : (
                  connectedEdges.map((e) => (
                    <div key={e.id} className={styles.edgeItem}>
                      <span>{e.relationship.replace('_', ' ')}</span>
                      <code style={{ fontSize: '0.68rem', color: '#38bdf8' }}>
                        {e.sourceId === selectedNode.id ? e.targetId : e.sourceId}
                      </code>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Quick Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginTop: 'auto' }}>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnPrimary}`}
                onClick={() => {
                  eventBus.publish('finding:added', {
                    finding: {
                      id: `FIND-${Date.now()}`,
                      title: `Security Gap identified on ${selectedNode.label}`,
                      severity: prioritizedInfo?.priorityLevel || 'medium',
                      targetEndpoint: selectedNode.label,
                      description: `Identified via Relational Attack Surface Graph.\nPriority Rationale:\n${prioritizedInfo?.rationales.join('\n')}`,
                      remediation: 'Verify authorization checks and defensive boundary controls.',
                      status: 'open',
                    },
                  });
                  toast('success', `Filed finding for '${selectedNode.label}' into Report Studio!`);
                }}
              >
                <PlusCircle size={13} /> File Finding
              </button>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.8rem', padding: '2rem' }}>
            Click any node on the canvas to inspect entity properties.
          </div>
        )}
      </div>
    </div>
  );
}
