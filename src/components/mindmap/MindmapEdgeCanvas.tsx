import React from 'react';
import type { MindmapEdge, MindmapNode } from '../../types/mindmap';

interface DraftEdge {
  fromNodeId: string;
  fromHandle: 'top' | 'right' | 'bottom' | 'left';
  cursorX: number;
  cursorY: number;
  targetHandle?: 'top' | 'right' | 'bottom' | 'left';
}

interface MindmapEdgeCanvasProps {
  edges: MindmapEdge[];
  nodes: MindmapNode[];
  draftEdge: DraftEdge | null;
  selectedEdgeId: string | null;
  onSelectEdge: (id: string | null) => void;
  onDeleteEdge: (id: string) => void;
}

export default function MindmapEdgeCanvas({
  edges,
  nodes,
  draftEdge,
  selectedEdgeId,
  onSelectEdge,
  onDeleteEdge,
}: MindmapEdgeCanvasProps) {
  const [hoveredEdgeId, setHoveredEdgeId] = React.useState<string | null>(null);
  const nodeMap = new Map<string, MindmapNode>();
  nodes.forEach((n) => nodeMap.set(n.id, n));

  const getHandleCoords = (
    node: MindmapNode,
    handle: 'top' | 'right' | 'bottom' | 'left' = 'right'
  ) => {
    switch (handle) {
      case 'top':
        return { x: node.x + node.width / 2, y: node.y, dirX: 0, dirY: -1 };
      case 'right':
        return { x: node.x + node.width, y: node.y + node.height / 2, dirX: 1, dirY: 0 };
      case 'bottom':
        return { x: node.x + node.width / 2, y: node.y + node.height, dirX: 0, dirY: 1 };
      case 'left':
        return { x: node.x, y: node.y + node.height / 2, dirX: -1, dirY: 0 };
    }
  };

  const computeBezierPath = (
    x1: number,
    y1: number,
    dirX1: number,
    dirY1: number,
    x2: number,
    y2: number,
    dirX2: number,
    dirY2: number
  ) => {
    const dx = Math.abs(x2 - x1);
    const dy = Math.abs(y2 - y1);
    const distance = Math.sqrt(dx * dx + dy * dy);
    const curvature = Math.min(Math.max(distance * 0.4, 40), 180);

    const cp1x = x1 + dirX1 * curvature;
    const cp1y = y1 + dirY1 * curvature;
    const cp2x = x2 + dirX2 * curvature;
    const cp2y = y2 + dirY2 * curvature;

    return `M ${x1} ${y1} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${x2} ${y2}`;
  };

  return (
    <svg
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        overflow: 'visible',
        zIndex: 5,
      }}
    >
      <defs>
        <marker
          id="mindmap-arrow-emerald"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 1 L 10 5 L 0 9 z" fill="#10b981" />
        </marker>
        <marker
          id="mindmap-arrow-selected"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse"
        >
          <path d="M 0 1 L 10 5 L 0 9 z" fill="#34d399" />
        </marker>
        <marker
          id="mindmap-arrow-draft"
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

      {/* Render All Existing Edges */}
      {edges.map((edge) => {
        const fromNode = nodeMap.get(edge.fromNodeId);
        const toNode = nodeMap.get(edge.toNodeId);
        if (!fromNode || !toNode) return null;

        const fromCoords = getHandleCoords(fromNode, edge.fromHandle || 'right');
        const toCoords = getHandleCoords(toNode, edge.toHandle || 'left');

        const dx = Math.abs(toCoords.x - fromCoords.x);
        const dy = Math.abs(toCoords.y - fromCoords.y);
        const distance = Math.sqrt(dx * dx + dy * dy);
        const curvature = Math.min(Math.max(distance * 0.4, 40), 180);

        const cp1x = fromCoords.x + fromCoords.dirX * curvature;
        const cp1y = fromCoords.y + fromCoords.dirY * curvature;
        const cp2x = toCoords.x + toCoords.dirX * curvature;
        const cp2y = toCoords.y + toCoords.dirY * curvature;

        const pathData = `M ${fromCoords.x} ${fromCoords.y} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${toCoords.x} ${toCoords.y}`;

        // True Cubic Bézier Midpoint at t = 0.5
        const bezierMidX = 0.125 * fromCoords.x + 0.375 * cp1x + 0.375 * cp2x + 0.125 * toCoords.x;
        const bezierMidY = 0.125 * fromCoords.y + 0.375 * cp1y + 0.375 * cp2y + 0.125 * toCoords.y;

        const isSelected = selectedEdgeId === edge.id;
        const isHovered = hoveredEdgeId === edge.id;
        const showDisconnect = isSelected || isHovered;

        return (
          <g
            key={edge.id}
            style={{ pointerEvents: 'auto' }}
            onMouseEnter={() => setHoveredEdgeId(edge.id)}
            onMouseLeave={() => setHoveredEdgeId((h) => (h === edge.id ? null : h))}
          >
            {/* Wide transparent stroke for easier hover/click hit testing */}
            <path
              d={pathData}
              fill="none"
              stroke="transparent"
              strokeWidth={20}
              style={{ cursor: 'pointer' }}
              onClick={(e) => {
                e.stopPropagation();
                onSelectEdge(edge.id);
              }}
            />
            {/* Visual stroke */}
            <path
              d={pathData}
              fill="none"
              stroke={isSelected ? '#34d399' : isHovered ? '#38bdf8' : edge.color || 'rgba(16, 185, 129, 0.75)'}
              strokeWidth={isSelected ? 3.5 : isHovered ? 3 : 2}
              strokeDasharray={
                edge.style === 'dashed' ? '6,6' : edge.style === 'dotted' ? '2,4' : undefined
              }
              markerEnd={
                isSelected ? 'url(#mindmap-arrow-selected)' : 'url(#mindmap-arrow-emerald)'
              }
              style={{
                cursor: 'pointer',
                transition: 'stroke 0.2s, stroke-width 0.2s',
                filter: isSelected
                  ? 'drop-shadow(0 0 8px rgba(52, 211, 153, 0.8))'
                  : isHovered
                  ? 'drop-shadow(0 0 6px rgba(56, 189, 248, 0.7))'
                  : undefined,
              }}
              onClick={(e) => {
                e.stopPropagation();
                onSelectEdge(edge.id);
              }}
            />

            {/* Optional Edge Label */}
            {edge.label && (
              <g transform={`translate(${bezierMidX}, ${bezierMidY - 14})`}>
                <rect
                  x={-edge.label.length * 4 - 8}
                  y={-10}
                  width={edge.label.length * 8 + 16}
                  height={20}
                  rx={10}
                  fill="#0f172a"
                  stroke={isSelected ? '#34d399' : '#334155'}
                  strokeWidth={1}
                />
                <text
                  x={0}
                  y={4}
                  textAnchor="middle"
                  fill={isSelected ? '#34d399' : '#94a3b8'}
                  fontSize={10}
                  fontWeight={600}
                >
                  {edge.label}
                </text>
              </g>
            )}

            {/* Disconnect / Delete Arrow Button on Exact Curve Midpoint */}
            {showDisconnect && (
              <g
                transform={`translate(${bezierMidX}, ${bezierMidY})`}
                style={{ cursor: 'pointer' }}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteEdge(edge.id);
                }}
              >
                <title>Disconnect Arrow (Delete)</title>
                {/* Glow ring */}
                <circle
                  r={14}
                  fill="#ef4444"
                  stroke="#020617"
                  strokeWidth={2}
                  style={{
                    filter: 'drop-shadow(0 0 8px rgba(239, 68, 68, 0.8))',
                    transition: 'transform 0.15s',
                  }}
                />
                {/* White X Icon */}
                <line x1={-4.5} y1={-4.5} x2={4.5} y2={4.5} stroke="#ffffff" strokeWidth={2} strokeLinecap="round" />
                <line x1={4.5} y1={-4.5} x2={-4.5} y2={4.5} stroke="#ffffff" strokeWidth={2} strokeLinecap="round" />
              </g>
            )}
          </g>
        );
      })}

      {/* Render Draft Edge being dragged live */}
      {draftEdge && (() => {
        const fromNode = nodeMap.get(draftEdge.fromNodeId);
        if (!fromNode) return null;
        const fromCoords = getHandleCoords(fromNode, draftEdge.fromHandle);
        const toX = draftEdge.cursorX;
        const toY = draftEdge.cursorY;

        let targetDirX = -fromCoords.dirX;
        let targetDirY = -fromCoords.dirY;

        if (draftEdge.targetHandle) {
          switch (draftEdge.targetHandle) {
            case 'top':
              targetDirX = 0;
              targetDirY = -1;
              break;
            case 'right':
              targetDirX = 1;
              targetDirY = 0;
              break;
            case 'bottom':
              targetDirX = 0;
              targetDirY = 1;
              break;
            case 'left':
              targetDirX = -1;
              targetDirY = 0;
              break;
          }
        }

        const pathData = computeBezierPath(
          fromCoords.x,
          fromCoords.y,
          fromCoords.dirX,
          fromCoords.dirY,
          toX,
          toY,
          targetDirX,
          targetDirY
        );

        return (
          <g>
            <path
              d={pathData}
              fill="none"
              stroke="#38bdf8"
              strokeWidth={2.5}
              strokeDasharray="5,5"
              markerEnd="url(#mindmap-arrow-draft)"
              style={{ filter: 'drop-shadow(0 0 8px rgba(56, 189, 248, 0.6))' }}
            />
            {draftEdge.targetHandle && (
              <circle
                cx={toX}
                cy={toY}
                r={8}
                fill="#38bdf8"
                stroke="#020617"
                strokeWidth={2}
                style={{
                  filter: 'drop-shadow(0 0 8px #38bdf8)',
                  animation: 'pulse 1s infinite',
                }}
              />
            )}
          </g>
        );
      })()}
    </svg>
  );
}
