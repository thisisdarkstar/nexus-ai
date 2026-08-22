import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Network,
  X,
  Plus,
  StickyNote,
  CreditCard,
  Image as ImageIcon,
  Square,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Sparkles,
  Download,
  Upload,
  Trash2,
  Workflow,
  Share2,
  Pencil,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import type {
  MindmapBoard,
  MindmapNode,
  MindmapEdge,
  MindmapNodeType,
  NodeColor,
} from '../../types/mindmap';
import MindmapNodeView from './MindmapNodeView';
import MindmapEdgeCanvas from './MindmapEdgeCanvas';
import styles from './MindmapStudio.module.css';

interface MindmapStudioProps {
  isOpen: boolean;
  onClose: () => void;
  onSendToAI?: (prompt: string) => void;
}

const STORAGE_KEY = 'nexus_mindmap_boards_data';

const DEFAULT_BOARDS: MindmapBoard[] = [
  {
    id: 'board_main',
    name: '🧠 Main Mindmap',
    zoom: 1,
    pan: { x: 120, y: 80 },
    createdAt: Date.now(),
    updatedAt: Date.now(),
    nodes: [
      {
        id: 'node_root',
        type: 'card',
        x: 350,
        y: 200,
        width: 260,
        height: 180,
        color: 'emerald',
        title: '🎯 Nexus Core Architecture',
        content: 'Central hub for AI agents, security tooling, and spatial ideation.',
        tags: ['architecture', 'core'],
        checklist: [
          { id: 'c1', text: 'Model orchestration engine', done: true },
          { id: 'c2', text: 'AppSec & VAPT Studio', done: true },
          { id: 'c3', text: 'Spatial Mindmap Canvas', done: true },
        ],
        zIndex: 10,
      },
      {
        id: 'node_note_1',
        type: 'note',
        x: 60,
        y: 100,
        width: 200,
        height: 140,
        color: 'blue',
        title: '💡 Quick Ideas',
        content: 'Connect thoughts with arrows.\nDrag handles to resize.\nDouble-click to edit anywhere!',
        zIndex: 10,
      },
      {
        id: 'node_note_2',
        type: 'note',
        x: 700,
        y: 120,
        width: 220,
        height: 140,
        color: 'purple',
        title: '🛡️ Security Modules',
        content: 'SAST Audit, HTTP Studio, Nuclei Engine, Payload Crafter, and Recon Hub.',
        zIndex: 10,
      },
      {
        id: 'node_note_3',
        type: 'note',
        x: 680,
        y: 340,
        width: 220,
        height: 140,
        color: 'amber',
        title: '⚡ Local & Private AI',
        content: 'Runs with Chrome Gemini Nano and local Ollama GGUF models directly on device.',
        zIndex: 10,
      },
    ],
    edges: [
      {
        id: 'edge_1',
        fromNodeId: 'node_note_1',
        fromHandle: 'right',
        toNodeId: 'node_root',
        toHandle: 'left',
        style: 'solid',
      },
      {
        id: 'edge_2',
        fromNodeId: 'node_root',
        fromHandle: 'right',
        toNodeId: 'node_note_2',
        toHandle: 'left',
        style: 'solid',
      },
      {
        id: 'edge_3',
        fromNodeId: 'node_root',
        fromHandle: 'right',
        toNodeId: 'node_note_3',
        toHandle: 'left',
        style: 'solid',
      },
    ],
  },
];

export default function MindmapStudio({ isOpen, onClose }: MindmapStudioProps) {
  const [boards, setBoards] = useState<MindmapBoard[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Failed to load mindmap boards:', e);
    }
    return DEFAULT_BOARDS;
  });

  const [activeBoardId, setActiveBoardId] = useState<string>(() => {
    return boards[0]?.id || 'board_main';
  });

  // Rename Board State
  const [editingBoardId, setEditingBoardId] = useState<string | null>(null);
  const [editingBoardName, setEditingBoardName] = useState('');

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);

  // Pan & Zoom
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 100, y: 60 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Dragging Node
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const dragStartPosRef = useRef<{ mouseX: number; mouseY: number; nodeX: number; nodeY: number }>({
    mouseX: 0,
    mouseY: 0,
    nodeX: 0,
    nodeY: 0,
  });

  // Resizing Node
  const [resizingNodeId, setResizingNodeId] = useState<string | null>(null);
  const resizeDirectionRef = useRef<string>('se');
  const resizeStartRef = useRef<{
    mouseX: number;
    mouseY: number;
    x: number;
    y: number;
    w: number;
    h: number;
  }>({ mouseX: 0, mouseY: 0, x: 0, y: 0, w: 0, h: 0 });

  // Creating Connector Arrow with Magnetic Port Snap
  const [draftEdge, setDraftEdge] = useState<{
    fromNodeId: string;
    fromHandle: 'top' | 'right' | 'bottom' | 'left';
    cursorX: number;
    cursorY: number;
    targetNodeId?: string;
    targetHandle?: 'top' | 'right' | 'bottom' | 'left';
  } | null>(null);

  // AI Brainstorm Modal
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [targetAiNode, setTargetAiNode] = useState<MindmapNode | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);
  const fileImportRef = useRef<HTMLInputElement>(null);
  const tabsContainerRef = useRef<HTMLDivElement>(null);

  const handleTabsWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (tabsContainerRef.current && e.deltaY !== 0) {
      tabsContainerRef.current.scrollLeft += e.deltaY;
    }
  };

  const handleScrollTabsLeft = () => {
    if (tabsContainerRef.current) {
      tabsContainerRef.current.scrollBy({ left: -140, behavior: 'smooth' });
    }
  };

  const handleScrollTabsRight = () => {
    if (tabsContainerRef.current) {
      tabsContainerRef.current.scrollBy({ left: 140, behavior: 'smooth' });
    }
  };

  // Find Closest Target Node & Handle with Magnetic Snapping
  const findBestTargetPort = useCallback(
    (
      worldX: number,
      worldY: number,
      fromNodeId: string,
      nodes: MindmapNode[]
    ): {
      targetNode: MindmapNode;
      targetHandle: 'top' | 'right' | 'bottom' | 'left';
      portX: number;
      portY: number;
    } | null => {
      let bestMatch: {
        targetNode: MindmapNode;
        targetHandle: 'top' | 'right' | 'bottom' | 'left';
        portX: number;
        portY: number;
        dist: number;
      } | null = null;

      const SNAP_THRESHOLD = 60; // 60px magnetic snap radius

      for (const node of nodes) {
        if (node.id === fromNodeId) continue;

        const ports: Array<{ handle: 'top' | 'right' | 'bottom' | 'left'; x: number; y: number }> = [
          { handle: 'top', x: node.x + node.width / 2, y: node.y },
          { handle: 'right', x: node.x + node.width, y: node.y + node.height / 2 },
          { handle: 'bottom', x: node.x + node.width / 2, y: node.y + node.height },
          { handle: 'left', x: node.x, y: node.y + node.height / 2 },
        ];

        // 1. Direct proximity to any of the 4 ports
        for (const p of ports) {
          const d = Math.hypot(p.x - worldX, p.y - worldY);
          if (d < SNAP_THRESHOLD) {
            if (!bestMatch || d < bestMatch.dist) {
              bestMatch = {
                targetNode: node,
                targetHandle: p.handle,
                portX: p.x,
                portY: p.y,
                dist: d,
              };
            }
          }
        }

        // 2. Proximity to node interior or bounding box edges (+20px margin)
        const isInside =
          worldX >= node.x - 20 &&
          worldX <= node.x + node.width + 20 &&
          worldY >= node.y - 20 &&
          worldY <= node.y + node.height + 20;

        if (isInside) {
          const distTop = Math.abs(worldY - node.y);
          const distBottom = Math.abs(worldY - (node.y + node.height));
          const distLeft = Math.abs(worldX - node.x);
          const distRight = Math.abs(worldX - (node.x + node.width));

          let closestHandle: 'top' | 'right' | 'bottom' | 'left' = 'left';
          let minEdgeDist = distLeft;
          let pX = node.x;
          let pY = node.y + node.height / 2;

          if (distRight < minEdgeDist) {
            minEdgeDist = distRight;
            closestHandle = 'right';
            pX = node.x + node.width;
            pY = node.y + node.height / 2;
          }
          if (distTop < minEdgeDist) {
            minEdgeDist = distTop;
            closestHandle = 'top';
            pX = node.x + node.width / 2;
            pY = node.y;
          }
          if (distBottom < minEdgeDist) {
            minEdgeDist = distBottom;
            closestHandle = 'bottom';
            pX = node.x + node.width / 2;
            pY = node.y + node.height;
          }

          if (!bestMatch || minEdgeDist < bestMatch.dist) {
            bestMatch = {
              targetNode: node,
              targetHandle: closestHandle,
              portX: pX,
              portY: pY,
              dist: minEdgeDist,
            };
          }
        }
      }

      return bestMatch
        ? {
            targetNode: bestMatch.targetNode,
            targetHandle: bestMatch.targetHandle,
            portX: bestMatch.portX,
            portY: bestMatch.portY,
          }
        : null;
    },
    []
  );

  // Get Active Board
  const activeBoard = boards.find((b) => b.id === activeBoardId) || boards[0];

  // Save to LocalStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(boards));
    } catch (e) {
      console.error('Failed to save mindmap boards:', e);
    }
  }, [boards]);

  // Synchronize board pan/zoom when switching boards
  useEffect(() => {
    if (activeBoard) {
      setZoom(activeBoard.zoom || 1);
      setPan(activeBoard.pan || { x: 100, y: 60 });
      setSelectedNodeId(null);
      setSelectedEdgeId(null);
    }
  }, [activeBoardId]);

  // Update Active Board helper
  const updateActiveBoard = useCallback(
    (updater: (board: MindmapBoard) => MindmapBoard) => {
      setBoards((prev) =>
        prev.map((b) => (b.id === activeBoard.id ? { ...updater(b), updatedAt: Date.now() } : b))
      );
    },
    [activeBoard.id]
  );

  // Convert Screen Mouse Coords to World Canvas Coords
  const screenToWorld = useCallback(
    (clientX: number, clientY: number) => {
      if (!canvasRef.current) return { x: 0, y: 0 };
      const rect = canvasRef.current.getBoundingClientRect();
      const x = (clientX - rect.left - pan.x) / zoom;
      const y = (clientY - rect.top - pan.y) / zoom;
      return { x, y };
    },
    [pan, zoom]
  );

  // Keyboard Shortcuts: Delete node/edge, Escape close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedNodeId) {
          handleDeleteNode(selectedNodeId);
        } else if (selectedEdgeId) {
          handleDeleteEdge(selectedEdgeId);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedNodeId, selectedEdgeId]);

  // Canvas Mouse Down -> Pan or Deselect
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0 || e.button === 1) {
      setSelectedNodeId(null);
      setSelectedEdgeId(null);
      setIsPanning(true);
      panStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
    }
  };

  // Mouse Move on Window -> Drag, Resize, Pan, or Draw Edge
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isPanning) {
        const nextPan = { x: e.clientX - panStartRef.current.x, y: e.clientY - panStartRef.current.y };
        setPan(nextPan);
        updateActiveBoard((b) => ({ ...b, pan: nextPan }));
      } else if (draggingNodeId) {
        const dx = (e.clientX - dragStartPosRef.current.mouseX) / zoom;
        const dy = (e.clientY - dragStartPosRef.current.mouseY) / zoom;
        const newX = Math.round(dragStartPosRef.current.nodeX + dx);
        const newY = Math.round(dragStartPosRef.current.nodeY + dy);
        updateActiveBoard((b) => ({
          ...b,
          nodes: b.nodes.map((n) => (n.id === draggingNodeId ? { ...n, x: newX, y: newY } : n)),
        }));
      } else if (resizingNodeId) {
        const dx = (e.clientX - resizeStartRef.current.mouseX) / zoom;
        const dy = (e.clientY - resizeStartRef.current.mouseY) / zoom;
        const dir = resizeDirectionRef.current;
        const s = resizeStartRef.current;

        let newW = s.w;
        let newH = s.h;
        let newX = s.x;
        let newY = s.y;

        if (dir.includes('e')) newW = Math.max(140, s.w + dx);
        if (dir.includes('s')) newH = Math.max(80, s.h + dy);
        if (dir.includes('w')) {
          const proposedW = s.w - dx;
          if (proposedW >= 140) {
            newW = proposedW;
            newX = s.x + dx;
          }
        }
        if (dir.includes('n')) {
          const proposedH = s.h - dy;
          if (proposedH >= 80) {
            newH = proposedH;
            newY = s.y + dy;
          }
        }

        updateActiveBoard((b) => ({
          ...b,
          nodes: b.nodes.map((n) =>
            n.id === resizingNodeId ? { ...n, width: newW, height: newH, x: newX, y: newY } : n
          ),
        }));
      } else if (draftEdge) {
        const worldPos = screenToWorld(e.clientX, e.clientY);
        const snap = findBestTargetPort(worldPos.x, worldPos.y, draftEdge.fromNodeId, activeBoard.nodes);
        if (snap) {
          setDraftEdge({
            fromNodeId: draftEdge.fromNodeId,
            fromHandle: draftEdge.fromHandle,
            cursorX: snap.portX,
            cursorY: snap.portY,
            targetNodeId: snap.targetNode.id,
            targetHandle: snap.targetHandle,
          });
        } else {
          setDraftEdge({
            fromNodeId: draftEdge.fromNodeId,
            fromHandle: draftEdge.fromHandle,
            cursorX: worldPos.x,
            cursorY: worldPos.y,
            targetNodeId: undefined,
            targetHandle: undefined,
          });
        }
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (isPanning) setIsPanning(false);
      if (draggingNodeId) setDraggingNodeId(null);
      if (resizingNodeId) setResizingNodeId(null);

      // Finish edge if dropped on or near target port/node
      if (draftEdge) {
        const worldPos = screenToWorld(e.clientX, e.clientY);
        const snap =
          (draftEdge.targetNodeId && draftEdge.targetHandle
            ? {
                targetNode: activeBoard.nodes.find((n) => n.id === draftEdge.targetNodeId),
                targetHandle: draftEdge.targetHandle,
              }
            : null) ||
          findBestTargetPort(worldPos.x, worldPos.y, draftEdge.fromNodeId, activeBoard.nodes);

        if (snap && snap.targetNode) {
          const newEdge: MindmapEdge = {
            id: 'edge_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
            fromNodeId: draftEdge.fromNodeId,
            fromHandle: draftEdge.fromHandle,
            toNodeId: snap.targetNode.id,
            toHandle: snap.targetHandle,
            style: 'solid',
          };
          updateActiveBoard((b) => ({
            ...b,
            edges: [...b.edges, newEdge],
          }));
        }
        setDraftEdge(null);
      }
    };

    if (isPanning || draggingNodeId || resizingNodeId || draftEdge) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [
    isPanning,
    draggingNodeId,
    resizingNodeId,
    draftEdge,
    zoom,
    pan,
    screenToWorld,
    updateActiveBoard,
    activeBoard.nodes,
  ]);

  // Wheel Zoom & Pan
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      // Zoom
      const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
      const nextZoom = Math.min(Math.max(zoom * zoomFactor, 0.25), 2.5);
      setZoom(nextZoom);
      updateActiveBoard((b) => ({ ...b, zoom: nextZoom }));
    } else {
      // Pan
      const nextPan = { x: pan.x - e.deltaX, y: pan.y - e.deltaY };
      setPan(nextPan);
      updateActiveBoard((b) => ({ ...b, pan: nextPan }));
    }
  };

  // Node Interactions
  const handleStartDrag = (nodeId: string, e: React.MouseEvent) => {
    const targetNode = activeBoard.nodes.find((n) => n.id === nodeId);
    if (!targetNode) return;
    setDraggingNodeId(nodeId);
    dragStartPosRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      nodeX: targetNode.x,
      nodeY: targetNode.y,
    };
  };

  const handleStartResize = (nodeId: string, direction: string, e: React.MouseEvent) => {
    const targetNode = activeBoard.nodes.find((n) => n.id === nodeId);
    if (!targetNode) return;
    setResizingNodeId(nodeId);
    resizeDirectionRef.current = direction;
    resizeStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      x: targetNode.x,
      y: targetNode.y,
      w: targetNode.width,
      h: targetNode.height,
    };
  };

  const handleStartConnect = (
    nodeId: string,
    handle: 'top' | 'right' | 'bottom' | 'left',
    e: React.MouseEvent
  ) => {
    const worldPos = screenToWorld(e.clientX, e.clientY);
    setDraftEdge({
      fromNodeId: nodeId,
      fromHandle: handle,
      cursorX: worldPos.x,
      cursorY: worldPos.y,
    });
  };

  const handleAddNode = (type: MindmapNodeType) => {
    const centerWorld = screenToWorld(window.innerWidth / 2, window.innerHeight / 2);
    const colors: NodeColor[] = ['emerald', 'blue', 'purple', 'amber', 'rose', 'slate'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    let width = 220;
    let height = 140;
    let title = 'Sticky Note';

    if (type === 'card') {
      width = 260;
      height = 180;
      title = 'Feature Card';
    } else if (type === 'image') {
      width = 240;
      height = 200;
      title = 'Visual Snapshot';
    } else if (type === 'frame') {
      width = 400;
      height = 300;
      title = 'Group Section';
    }

    const newNode: MindmapNode = {
      id: 'node_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      type,
      x: Math.round(centerWorld.x - width / 2),
      y: Math.round(centerWorld.y - height / 2),
      width,
      height,
      color: randomColor,
      title,
      content: '',
      tags: type === 'card' ? ['todo'] : undefined,
      checklist: type === 'card' ? [{ id: '1', text: 'Define subtask', done: false }] : undefined,
      zIndex: type === 'frame' ? 1 : 10,
    };

    updateActiveBoard((b) => ({ ...b, nodes: [...b.nodes, newNode] }));
    setSelectedNodeId(newNode.id);
  };

  const handleUpdateNode = (id: string, updates: Partial<MindmapNode>) => {
    updateActiveBoard((b) => ({
      ...b,
      nodes: b.nodes.map((n) => (n.id === id ? { ...n, ...updates } : n)),
    }));
  };

  const handleDeleteNode = (id: string) => {
    updateActiveBoard((b) => ({
      ...b,
      nodes: b.nodes.filter((n) => n.id !== id),
      edges: b.edges.filter((e) => e.fromNodeId !== id && e.toNodeId !== id),
    }));
    if (selectedNodeId === id) setSelectedNodeId(null);
  };

  const handleDuplicateNode = (id: string) => {
    const node = activeBoard.nodes.find((n) => n.id === id);
    if (!node) return;
    const duplicated: MindmapNode = {
      ...node,
      id: 'node_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      x: node.x + 30,
      y: node.y + 30,
      title: node.title ? `${node.title} (Copy)` : '',
    };
    updateActiveBoard((b) => ({ ...b, nodes: [...b.nodes, duplicated] }));
    setSelectedNodeId(duplicated.id);
  };

  const handleDeleteEdge = (id: string) => {
    updateActiveBoard((b) => ({
      ...b,
      edges: b.edges.filter((e) => e.id !== id),
    }));
    if (selectedEdgeId === id) setSelectedEdgeId(null);
  };

  // Auto Layout Hierarchy Algorithm (Organic Left-to-Right Mindmap)
  const handleAutoLayout = () => {
    if (activeBoard.nodes.length === 0) return;

    const nodes = [...activeBoard.nodes];
    const edges = activeBoard.edges;

    // Find Root Nodes (nodes with no incoming edges)
    const incomingCount = new Map<string, number>();
    nodes.forEach((n) => incomingCount.set(n.id, 0));
    edges.forEach((e) => {
      incomingCount.set(e.toNodeId, (incomingCount.get(e.toNodeId) || 0) + 1);
    });

    let rootNodes = nodes.filter((n) => incomingCount.get(n.id) === 0);
    if (rootNodes.length === 0) rootNodes = [nodes[0]];

    const startX = 100;
    let currentY = 100;
    const columnGap = 320;
    const rowGap = 180;

    const visited = new Set<string>();
    const nodePositions = new Map<string, { x: number; y: number }>();

    const layoutSubtree = (nodeId: string, col: number, startY: number): number => {
      visited.add(nodeId);
      const childEdges = edges.filter((e) => e.fromNodeId === nodeId && !visited.has(e.toNodeId));

      let totalY = startY;
      if (childEdges.length === 0) {
        nodePositions.set(nodeId, { x: startX + col * columnGap, y: startY });
        return startY + rowGap;
      }

      let childY = startY;
      childEdges.forEach((e) => {
        childY = layoutSubtree(e.toNodeId, col + 1, childY);
      });

      const firstChildPos = nodePositions.get(childEdges[0].toNodeId)!;
      const lastChildPos = nodePositions.get(childEdges[childEdges.length - 1].toNodeId)!;
      const midY = (firstChildPos.y + lastChildPos.y) / 2;

      nodePositions.set(nodeId, { x: startX + col * columnGap, y: midY });
      return childY;
    };

    rootNodes.forEach((root) => {
      currentY = layoutSubtree(root.id, 0, currentY);
    });

    // Unconnected nodes
    nodes.forEach((n) => {
      if (!visited.has(n.id)) {
        nodePositions.set(n.id, { x: startX, y: currentY });
        currentY += rowGap;
      }
    });

    updateActiveBoard((b) => ({
      ...b,
      nodes: b.nodes.map((n) => {
        const pos = nodePositions.get(n.id);
        return pos ? { ...n, x: pos.x, y: pos.y } : n;
      }),
    }));
  };

  // AI Expand / Brainstorm Node
  const handleAIExpand = (node: MindmapNode) => {
    setTargetAiNode(node);
    setAiPrompt(`Brainstorm 3 sub-components or ideas for: ${node.title || node.content}`);
    setAiModalOpen(true);
  };

  const handleExecuteAIExpand = () => {
    if (!targetAiNode) return;
    const baseTitle = targetAiNode.title || 'Idea';
    const subTopics = [
      `1. Analysis & Metrics for ${baseTitle}`,
      `2. Implementation Vectors`,
      `3. Security & Validation Controls`,
    ];

    const newNodes: MindmapNode[] = subTopics.map((topic, i) => ({
      id: 'node_ai_' + Date.now() + '_' + i,
      type: 'note',
      x: targetAiNode.x + targetAiNode.width + 120,
      y: targetAiNode.y + (i - 1) * 160,
      width: 220,
      height: 120,
      color: i === 0 ? 'emerald' : i === 1 ? 'blue' : 'purple',
      title: topic,
      content: `AI generated branch for ${baseTitle}.\nReady for further detailing.`,
      zIndex: 10,
    }));

    const newEdges: MindmapEdge[] = newNodes.map((nn, i) => ({
      id: 'edge_ai_' + Date.now() + '_' + i,
      fromNodeId: targetAiNode.id,
      fromHandle: 'right',
      toNodeId: nn.id,
      toHandle: 'left',
      style: 'solid',
    }));

    updateActiveBoard((b) => ({
      ...b,
      nodes: [...b.nodes, ...newNodes],
      edges: [...b.edges, ...newEdges],
    }));

    setAiModalOpen(false);
    setTargetAiNode(null);
  };

  // Boards Management
  const handleAddBoard = () => {
    const newBoard: MindmapBoard = {
      id: 'board_' + Date.now(),
      name: `Board ${boards.length + 1}`,
      zoom: 1,
      pan: { x: 100, y: 60 },
      nodes: [
        {
          id: 'node_init',
          type: 'card',
          x: 300,
          y: 200,
          width: 240,
          height: 140,
          color: 'emerald',
          title: '✨ New Board',
          content: 'Add notes, cards, and images from the top toolbar.',
        },
      ],
      edges: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setBoards((prev) => [...prev, newBoard]);
    setActiveBoardId(newBoard.id);
  };

  const handleStartRenameBoard = (boardId: string, currentName: string) => {
    setEditingBoardId(boardId);
    setEditingBoardName(currentName);
  };

  const handleSaveRenameBoard = () => {
    if (editingBoardId && editingBoardName.trim()) {
      setBoards((prev) =>
        prev.map((b) => (b.id === editingBoardId ? { ...b, name: editingBoardName.trim() } : b))
      );
    }
    setEditingBoardId(null);
    setEditingBoardName('');
  };

  const handleDeleteBoard = (boardId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (boards.length <= 1) return;
    const remainingBoards = boards.filter((b) => b.id !== boardId);
    setBoards(remainingBoards);
    if (activeBoardId === boardId) {
      setActiveBoardId(remainingBoards[0].id);
    }
  };

  const handleClearCurrentBoard = () => {
    updateActiveBoard((b) => ({
      ...b,
      nodes: [],
      edges: [],
    }));
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
  };

  const handleExportJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(boards, null, 2));
    const a = document.createElement('a');
    a.setAttribute('href', dataStr);
    a.setAttribute('download', `nexus_mindmap_${Date.now()}.json`);
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const parsed = JSON.parse(evt.target?.result as string);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setBoards(parsed);
            setActiveBoardId(parsed[0].id);
          }
        } catch (err) {
          console.error('Failed to parse JSON file:', err);
        }
      };
      reader.readAsText(file);
    }
  };

  const handleResetZoom = () => {
    setZoom(1);
    setPan({ x: 100, y: 60 });
    updateActiveBoard((b) => ({ ...b, zoom: 1, pan: { x: 100, y: 60 } }));
  };

  if (!isOpen) return null;

  return (
    <div className={styles.overlay}>
      {/* Top Controls Bar */}
      <div className={styles.topBar}>
        <div className={styles.topBarLeft}>
          <div className={styles.brandLogo}>
            <Network size={20} />
            <span>Nexus Mindmap</span>
          </div>

          {/* Board Tabs with Inline Rename & Delete and Horizontal Wheel Scroll */}
          <div className={styles.boardTabsWrapper}>
            {boards.length > 2 && (
              <button
                className={styles.tabScrollBtn}
                onClick={handleScrollTabsLeft}
                title="Scroll boards left"
              >
                <ChevronLeft size={13} />
              </button>
            )}

            <div
              ref={tabsContainerRef}
              className={styles.boardTabsContainer}
              onWheel={handleTabsWheel}
            >
              {boards.map((b) => {
                const isActive = b.id === activeBoardId;
                const isEditing = editingBoardId === b.id;

                return (
                  <div
                    key={b.id}
                    className={`${styles.boardTab} ${isActive ? styles.boardTabActive : ''}`}
                    onClick={() => setActiveBoardId(b.id)}
                    title="Click to switch, double-click to rename"
                  >
                    {isEditing ? (
                      <input
                        type="text"
                        value={editingBoardName}
                        onChange={(e) => setEditingBoardName(e.target.value)}
                        onBlur={handleSaveRenameBoard}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveRenameBoard();
                          if (e.key === 'Escape') setEditingBoardId(null);
                        }}
                        autoFocus
                        className={styles.boardTabInput}
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <>
                        <span
                          className={styles.boardTabName}
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            handleStartRenameBoard(b.id, b.name);
                          }}
                        >
                          {b.name}
                        </span>
                        <button
                          className={styles.boardTabActionBtn}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStartRenameBoard(b.id, b.name);
                          }}
                          title="Rename Board"
                        >
                          <Pencil size={11} />
                        </button>
                        {boards.length > 1 && (
                          <button
                            className={`${styles.boardTabActionBtn} ${styles.boardTabDeleteBtn}`}
                            onClick={(e) => handleDeleteBoard(b.id, e)}
                            title="Delete Board"
                          >
                            <Trash2 size={11} />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            {boards.length > 2 && (
              <button
                className={styles.tabScrollBtn}
                onClick={handleScrollTabsRight}
                title="Scroll boards right"
              >
                <ChevronRight size={13} />
              </button>
            )}

            <button className={styles.newBoardBtn} onClick={handleAddBoard} title="New Board">
              <Plus size={14} />
            </button>
          </div>
        </div>

        {/* Node & Action Palette */}
        <div className={styles.paletteContainer}>
          <button className={styles.toolBtn} onClick={() => handleAddNode('note')} title="Add Sticky Note">
            <StickyNote size={15} color="#3b82f6" /> Note
          </button>
          <button className={styles.toolBtn} onClick={() => handleAddNode('card')} title="Add Feature Card">
            <CreditCard size={15} color="#10b981" /> Card
          </button>
          <button className={styles.toolBtn} onClick={() => handleAddNode('image')} title="Add Image Node">
            <ImageIcon size={15} color="#a855f7" /> Image
          </button>
          <button className={styles.toolBtn} onClick={() => handleAddNode('frame')} title="Add Group Section Frame">
            <Square size={15} color="#f59e0b" /> Frame
          </button>
          <button className={styles.toolBtn} onClick={handleAutoLayout} title="Auto-organize Mindmap Hierarchy">
            <Workflow size={15} color="#34d399" /> Auto Layout
          </button>
        </div>

        {/* Right Action Tools */}
        <div className={styles.topBarRight}>
          <button className={styles.iconBtn} onClick={handleClearCurrentBoard} title="Clear Current Board Canvas">
            <Trash2 size={16} />
          </button>
          <button className={styles.iconBtn} onClick={handleExportJSON} title="Export Mindmap as JSON">
            <Download size={16} />
          </button>
          <button
            className={styles.iconBtn}
            onClick={() => fileImportRef.current?.click()}
            title="Import Mindmap JSON"
          >
            <Upload size={16} />
          </button>
          <input
            ref={fileImportRef}
            type="file"
            accept=".json"
            style={{ display: 'none' }}
            onChange={handleImportJSON}
          />
          <button
            className={`${styles.iconBtn} ${styles.iconBtnClose}`}
            onClick={onClose}
            title="Close Mindmap (Esc)"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Infinite Canvas */}
      <div
        ref={canvasRef}
        className={styles.canvasContainer}
        onMouseDown={handleCanvasMouseDown}
        onWheel={handleWheel}
      >
        <div
          className={styles.worldLayer}
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          }}
        >
          {/* SVG Arrow Connectors Layer */}
          <MindmapEdgeCanvas
            edges={activeBoard.edges}
            nodes={activeBoard.nodes}
            draftEdge={draftEdge}
            selectedEdgeId={selectedEdgeId}
            onSelectEdge={(id) => {
              setSelectedEdgeId(id);
              setSelectedNodeId(null);
            }}
            onDeleteEdge={handleDeleteEdge}
          />

          {/* Interactive Nodes Layer */}
          {activeBoard.nodes.map((node) => (
            <MindmapNodeView
              key={node.id}
              node={node}
              isSelected={selectedNodeId === node.id}
              onSelect={(id) => {
                setSelectedNodeId(id);
                setSelectedEdgeId(null);
              }}
              onUpdate={handleUpdateNode}
              onDelete={handleDeleteNode}
              onDuplicate={handleDuplicateNode}
              onAIExpand={handleAIExpand}
              onStartConnect={handleStartConnect}
              onStartDrag={handleStartDrag}
              onStartResize={handleStartResize}
            />
          ))}
        </div>

        {/* Floating Zoom & Pan HUD */}
        <div className={styles.floatingHud}>
          <button
            className={styles.hudBtn}
            onClick={() => {
              const next = Math.max(zoom - 0.15, 0.25);
              setZoom(next);
              updateActiveBoard((b) => ({ ...b, zoom: next }));
            }}
            title="Zoom Out"
          >
            <ZoomOut size={16} />
          </button>
          <span className={styles.zoomLabel}>{Math.round(zoom * 100)}%</span>
          <button
            className={styles.hudBtn}
            onClick={() => {
              const next = Math.min(zoom + 0.15, 2.5);
              setZoom(next);
              updateActiveBoard((b) => ({ ...b, zoom: next }));
            }}
            title="Zoom In"
          >
            <ZoomIn size={16} />
          </button>
          <button className={styles.hudBtn} onClick={handleResetZoom} title="Reset View (100%)">
            <Maximize2 size={16} />
          </button>
        </div>

        {/* Selected Edge Inspector Toolbar */}
        {selectedEdgeId && (() => {
          const selectedEdge = activeBoard.edges.find((e) => e.id === selectedEdgeId);
          if (!selectedEdge) return null;

          return (
            <div className={styles.edgeToolbar} onMouseDown={(e) => e.stopPropagation()}>
              <span className={styles.edgeToolbarLabel}>Connector:</span>
              <input
                type="text"
                value={selectedEdge.label || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  updateActiveBoard((b) => ({
                    ...b,
                    edges: b.edges.map((edge) =>
                      edge.id === selectedEdge.id ? { ...edge, label: val } : edge
                    ),
                  }));
                }}
                placeholder="Label..."
                className={styles.edgeLabelInput}
              />
              <button
                className={`${styles.edgeStyleBtn} ${
                  !selectedEdge.style || selectedEdge.style === 'solid'
                    ? styles.edgeStyleBtnActive
                    : ''
                }`}
                onClick={() => {
                  updateActiveBoard((b) => ({
                    ...b,
                    edges: b.edges.map((edge) =>
                      edge.id === selectedEdge.id ? { ...edge, style: 'solid' } : edge
                    ),
                  }));
                }}
              >
                Solid
              </button>
              <button
                className={`${styles.edgeStyleBtn} ${
                  selectedEdge.style === 'dashed' ? styles.edgeStyleBtnActive : ''
                }`}
                onClick={() => {
                  updateActiveBoard((b) => ({
                    ...b,
                    edges: b.edges.map((edge) =>
                      edge.id === selectedEdge.id ? { ...edge, style: 'dashed' } : edge
                    ),
                  }));
                }}
              >
                Dashed
              </button>
              <button
                className={`${styles.edgeStyleBtn} ${
                  selectedEdge.style === 'dotted' ? styles.edgeStyleBtnActive : ''
                }`}
                onClick={() => {
                  updateActiveBoard((b) => ({
                    ...b,
                    edges: b.edges.map((edge) =>
                      edge.id === selectedEdge.id ? { ...edge, style: 'dotted' } : edge
                    ),
                  }));
                }}
              >
                Dotted
              </button>
              <button
                className={styles.edgeDeleteBtn}
                onClick={() => handleDeleteEdge(selectedEdge.id)}
                title="Disconnect Arrow"
              >
                <Trash2 size={13} /> Disconnect
              </button>
            </div>
          );
        })()}
      </div>

      {/* AI Expansion Modal */}
      {aiModalOpen && (
        <div className={styles.aiModal}>
          <div className={styles.aiModalHeader}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Sparkles size={16} />
              <span>AI Mindmap Expansion</span>
            </div>
            <button
              style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer' }}
              onClick={() => setAiModalOpen(false)}
            >
              <X size={16} />
            </button>
          </div>
          <input
            type="text"
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            className={styles.aiInput}
            placeholder="AI prompt for branching ideas..."
          />
          <button className={styles.aiSubmitBtn} onClick={handleExecuteAIExpand}>
            <Sparkles size={14} /> Generate & Connect Sub-Nodes
          </button>
        </div>
      )}
    </div>
  );
}
