import { useState, useEffect, useRef, useMemo } from 'react';
import {
  Share2,
  Search,
  Filter,
  PlusCircle,
  ExternalLink,
  Sparkles,
  Layers,
  Shield,
  Activity,
  RotateCcw,
} from 'lucide-react';
import { AssetGraph } from '../../domain/graph/AssetGraph';
import type { GraphNode, GraphEdge, AssetNodeType } from '../../domain/graph/types';
import { prioritizationEngine } from '../../domain/prioritization/PrioritizationEngine';
import { storageManager } from '../../core/storage/StorageManager';
import { eventBus } from '../../core/bus/EventBus';
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

export default function AssetGraphViewer({ onSendToAI, onTabChange }: AssetGraphViewerProps) {
  const [graph] = useState<AssetGraph>(() => new AssetGraph('default'));
  const [nodes, setNodes] = useState<SimNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const panOffset = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const zoomScale = useRef<number>(1);
  const isDragging = useRef<boolean>(false);
  const dragStart = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const draggedNode = useRef<SimNode | null>(null);

  // Initialize and populate graph
  const loadGraphData = async () => {
    let assets: ReconAsset[] = [];
    let scopeRules: ScopeItem[] = [];

    try {
      const storedAssets = await storageManager.getAssets('default');
      if (storedAssets && storedAssets.length > 0) {
        assets = storedAssets as unknown as ReconAsset[];
      } else {
        // Fallback demo surface
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

      const storedScope = await storageManager.getScope('default');
      if (storedScope && storedScope.length > 0) {
        scopeRules = storedScope;
      }
    } catch {
      // ignore
    }

    graph.clear();
    graph.buildFromFlatAssets(assets, 'default', scopeRules);

    const rawNodes = graph.getAllNodes();
    const rawEdges = graph.getAllEdges();

    // Assign randomized layout initial positions around center
    const simNodes: SimNode[] = rawNodes.map((n, i) => {
      const angle = (i / rawNodes.length) * 2 * Math.PI;
      const radius = 120 + Math.random() * 100;
      return {
        ...n,
        x: 350 + Math.cos(angle) * radius,
        y: 250 + Math.sin(angle) * radius,
        vx: 0,
        vy: 0,
      };
    });

    setNodes(simNodes);
    setEdges(rawEdges);
    setSelectedNodeId(simNodes[0]?.id || null);
  };

  useEffect(() => {
    loadGraphData();
  }, []);

  // Simple Force-Directed Simulation Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let running = true;

    const render = () => {
      if (!running) return;

      // Physics step
      for (let i = 0; i < nodes.length; i++) {
        const n1 = nodes[i];
        if (n1 === draggedNode.current) continue;

        // Center gravity
        n1.vx += (350 - n1.x) * 0.0005;
        n1.vy += (250 - n1.y) * 0.0005;

        // Node repulsion
        for (let j = i + 1; j < nodes.length; j++) {
          const n2 = nodes[j];
          const dx = n2.x - n1.x;
          const dy = n2.y - n1.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          if (dist < 180) {
            const force = (180 - dist) / dist * 0.03;
            n1.vx -= dx * force;
            n1.vy -= dy * force;
            n2.vx += dx * force;
            n2.vy += dy * force;
          }
        }
      }

      // Edge spring attraction
      for (const edge of edges) {
        const src = nodes.find((n) => n.id === edge.sourceId);
        const tgt = nodes.find((n) => n.id === edge.targetId);
        if (src && tgt) {
          const dx = tgt.x - src.x;
          const dy = tgt.y - src.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = (dist - 80) * 0.002;
          if (src !== draggedNode.current) {
            src.vx += dx * force;
            src.vy += dy * force;
          }
          if (tgt !== draggedNode.current) {
            tgt.vx -= dx * force;
            tgt.vy -= dy * force;
          }
        }
      }

      // Update velocities & positions with friction damping
      for (const n of nodes) {
        if (n !== draggedNode.current) {
          n.x += n.vx;
          n.y += n.vy;
          n.vx *= 0.88;
          n.vy *= 0.88;
        }
      }

      // Render Canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.translate(panOffset.current.x, panOffset.current.y);
      ctx.scale(zoomScale.current, zoomScale.current);

      // Draw Edges
      for (const edge of edges) {
        const src = nodes.find((n) => n.id === edge.sourceId);
        const tgt = nodes.find((n) => n.id === edge.targetId);
        if (src && tgt) {
          ctx.beginPath();
          ctx.moveTo(src.x, src.y);
          ctx.lineTo(tgt.x, tgt.y);
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }

      // Draw Nodes
      for (const node of nodes) {
        const isSelected = node.id === selectedNodeId;
        const color = NODE_COLORS[node.type] || '#38bdf8';

        // Outer glow on selected
        if (isSelected) {
          ctx.beginPath();
          ctx.arc(node.x, node.y, 14, 0, 2 * Math.PI);
          ctx.fillStyle = `${color}40`;
          ctx.fill();
        }

        ctx.beginPath();
        ctx.arc(node.x, node.y, node.type === 'domain' ? 9 : 6, 0, 2 * Math.PI);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = isSelected ? '#ffffff' : 'rgba(0, 0, 0, 0.6)';
        ctx.lineWidth = isSelected ? 2 : 1;
        ctx.stroke();

        // Label
        ctx.font = '10px monospace';
        ctx.fillStyle = isSelected ? '#ffffff' : '#94a3b8';
        const truncatedLabel = node.label.length > 20 ? `${node.label.slice(0, 18)}...` : node.label;
        ctx.fillText(truncatedLabel, node.x + 9, node.y + 3);
      }

      ctx.restore();
      animFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      running = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [nodes, edges, selectedNodeId]);

  // Pointer interactions
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left - panOffset.current.x) / zoomScale.current;
    const mouseY = (e.clientY - rect.top - panOffset.current.y) / zoomScale.current;

    // Hit test nodes
    for (const n of nodes) {
      const dx = n.x - mouseX;
      const dy = n.y - mouseY;
      if (dx * dx + dy * dy < 144) {
        draggedNode.current = n;
        setSelectedNodeId(n.id);
        return;
      }
    }

    isDragging.current = true;
    dragStart.current = { x: e.clientX - panOffset.current.x, y: e.clientY - panOffset.current.y };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (draggedNode.current) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      draggedNode.current.x = (e.clientX - rect.left - panOffset.current.x) / zoomScale.current;
      draggedNode.current.y = (e.clientY - rect.top - panOffset.current.y) / zoomScale.current;
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
                  `As an Application Security Architect, evaluate this node in the Attack Surface Graph:\n\nType: ${selectedNode.type}\nLabel: ${selectedNode.label}\nRisk Score: ${prioritizedInfo?.compositeScore || 'N/A'}/100\nPriority: ${prioritizedInfo?.priorityLevel.toUpperCase() || 'N/A'}\n\nRationales:\n${prioritizedInfo?.rationales.map((r) => `- ${r}`).join('\n')}\n\nPlease provide a targeted assessment plan.`
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
        <input
          className={styles.searchBox}
          placeholder="Search graph nodes..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', fontSize: '0.78rem', color: '#94a3b8' }}>
          <span>{nodes.length} Nodes</span>
          <span>•</span>
          <span>{edges.length} Edges</span>
        </div>
      </div>

      {/* Graph Canvas & Side Inspector */}
      <div className={styles.graphLayout}>
        <div className={styles.canvasContainer}>
          <canvas
            ref={canvasRef}
            width={750}
            height={500}
            className={styles.canvas}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
          />
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
                {connectedEdges.map((e) => (
                  <div key={e.id} className={styles.edgeItem}>
                    <span>{e.relationship.replace('_', ' ')}</span>
                    <code style={{ fontSize: '0.68rem', color: '#38bdf8' }}>
                      {e.sourceId === selectedNode.id ? e.targetId : e.sourceId}
                    </code>
                  </div>
                ))}
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
                  alert(`Filed finding for '${selectedNode.label}' into Report Studio!`);
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
