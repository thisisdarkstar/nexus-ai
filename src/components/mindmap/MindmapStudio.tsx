import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import type {
  MindmapBoard,
  MindmapNode,
  MindmapEdge,
  MindmapNodeType,
  NodeColor,
} from '../../types/mindmap';
import { DEFAULT_MINDMAP_BOARDS } from '../../data/mindmap/defaultTemplates';
import { useUndoRedo } from '../../lib/useUndoRedo';
import { useToast } from '../../lib/toast';
import MindmapTopBar from './MindmapTopBar';
import MindmapNodeView from './MindmapNodeView';
import MindmapEdgeCanvas from './MindmapEdgeCanvas';
import MindmapEdgeToolbar from './MindmapEdgeToolbar';
import MindmapAiModal from './MindmapAiModal';
import styles from './MindmapStudio.module.css';

interface MindmapStudioProps {
  isOpen: boolean;
  onClose: () => void;
  onSendToAI?: (prompt: string) => void;
}

type BoardSnapshot = { nodes: MindmapNode[]; edges: MindmapEdge[] };

const STORAGE_KEY = 'nexus_mindmap_boards_data';

export default function MindmapStudio({ isOpen, onClose }: MindmapStudioProps) {
  const { toast } = useToast();
  const [boards, setBoards] = useState<MindmapBoard[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Failed to load mindmap boards:', e);
    }
    return DEFAULT_MINDMAP_BOARDS;
  });

  const [activeBoardId, setActiveBoardId] = useState<string>(() => {
    return boards[0]?.id || 'board_main';
  });

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

  // Active Board helper
  const activeBoard = boards.find((b) => b.id === activeBoardId) || boards[0] || DEFAULT_MINDMAP_BOARDS[0];

  // Undo / Redo history for destructive board operations
  const {
    pushSnapshot: pushBoardSnapshot,
    undo: undoBoardSnapshot,
    redo: redoBoardSnapshot,
    canUndo,
    canRedo,
  } = useUndoRedo<BoardSnapshot>(50);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(boards));
    } catch (e) {
      console.error('Failed to save mindmap boards:', e);
    }
  }, [boards]);

  // Sync pan & zoom when board changes
  useEffect(() => {
    if (activeBoard) {
      setPan(activeBoard.pan || { x: 100, y: 60 });
      setZoom(activeBoard.zoom || 1);
    }
  }, [activeBoardId]);

  const updateActiveBoard = useCallback(
    (updater: (board: MindmapBoard) => MindmapBoard) => {
      setBoards((prev) =>
        prev.map((b) => (b.id === activeBoardId ? { ...updater(b), updatedAt: Date.now() } : b))
      );
    },
    [activeBoardId]
  );

  // Snapshot the active board's nodes + edges before any destructive operation
  const snapshotBoard = useCallback(() => {
    pushBoardSnapshot({
      nodes: activeBoard.nodes.map((n) => ({ ...n })),
      edges: activeBoard.edges.map((e) => ({ ...e })),
    });
  }, [activeBoard, pushBoardSnapshot]);

  const applyBoardSnapshot = useCallback(
    (snap: BoardSnapshot | null) => {
      if (!snap) return;
      updateActiveBoard((b) => ({ ...b, nodes: snap.nodes, edges: snap.edges }));
      setSelectedNodeId(null);
      setSelectedEdgeId(null);
    },
    [updateActiveBoard]
  );

  const handleUndo = useCallback(() => {
    applyBoardSnapshot(undoBoardSnapshot({ nodes: activeBoard.nodes, edges: activeBoard.edges }));
  }, [activeBoard, undoBoardSnapshot, applyBoardSnapshot]);

  const handleRedo = useCallback(() => {
    applyBoardSnapshot(redoBoardSnapshot({ nodes: activeBoard.nodes, edges: activeBoard.edges }));
  }, [activeBoard, redoBoardSnapshot, applyBoardSnapshot]);

  // Board Management
  const handleAddBoard = () => {
    const newBoardId = 'board_' + Date.now();
    const newBoard: MindmapBoard = {
      id: newBoardId,
      name: `🧠 Board ${boards.length + 1}`,
      zoom: 1,
      pan: { x: 100, y: 60 },
      createdAt: Date.now(),
      updatedAt: Date.now(),
      nodes: [
        {
          id: 'node_init_' + Date.now(),
          type: 'card',
          x: 200,
          y: 150,
          width: 260,
          height: 160,
          color: 'emerald',
          title: '💡 Central Idea',
          content: 'Start expanding your thoughts here. Connect arrows to branch out ideas.',
          zIndex: 10,
        },
      ],
      edges: [],
    };
    setBoards((prev) => [...prev, newBoard]);
    setActiveBoardId(newBoardId);
  };

  const handleRenameBoard = (boardId: string, newName: string) => {
    setBoards((prev) =>
      prev.map((b) => (b.id === boardId ? { ...b, name: newName, updatedAt: Date.now() } : b))
    );
  };

  const handleDeleteBoard = (boardId: string) => {
    if (boards.length <= 1) return;
    const remaining = boards.filter((b) => b.id !== boardId);
    setBoards(remaining);
    if (activeBoardId === boardId) {
      setActiveBoardId(remaining[0].id);
    }
  };

  const handleClearCurrentBoard = () => {
    snapshotBoard();
    updateActiveBoard((b) => ({
      ...b,
      nodes: [],
      edges: [],
    }));
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
  };

  // Node Operations
  const handleAddNode = (type: MindmapNodeType, color: NodeColor = 'blue') => {
    const canvasBounds = canvasRef.current?.getBoundingClientRect();
    const centerX = canvasBounds ? (canvasBounds.width / 2 - pan.x) / zoom : 300;
    const centerY = canvasBounds ? (canvasBounds.height / 2 - pan.y) / zoom : 200;

    const titles: Record<MindmapNodeType, string> = {
      note: 'Sticky Note',
      card: 'New Feature Card',
      image: 'Image Node',
      frame: 'Group Container',
    };

    const newNode: MindmapNode = {
      id: 'node_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      type,
      x: Math.round(centerX - 100 + (Math.random() * 40 - 20)),
      y: Math.round(centerY - 80 + (Math.random() * 40 - 20)),
      width: type === 'frame' ? 360 : type === 'card' ? 260 : 200,
      height: type === 'frame' ? 260 : type === 'card' ? 180 : 140,
      color,
      title: titles[type],
      content: type === 'card' ? 'Describe component architecture or features...' : 'Type notes...',
      tags: type === 'card' ? ['feature'] : undefined,
      zIndex: 10,
    };

    snapshotBoard();
    updateActiveBoard((b) => ({
      ...b,
      nodes: [...b.nodes, newNode],
    }));
    setSelectedNodeId(newNode.id);
  };

  const handleUpdateNode = (id: string, updates: Partial<MindmapNode>) => {
    updateActiveBoard((b) => ({
      ...b,
      nodes: b.nodes.map((n) => (n.id === id ? { ...n, ...updates } : n)),
    }));
  };

  const handleDeleteNode = (id: string) => {
    snapshotBoard();
    updateActiveBoard((b) => ({
      ...b,
      nodes: b.nodes.filter((n) => n.id !== id),
      edges: b.edges.filter((e) => e.fromNodeId !== id && e.toNodeId !== id),
    }));
    if (selectedNodeId === id) setSelectedNodeId(null);
  };

  const handleDuplicateNode = (id: string) => {
    const target = activeBoard.nodes.find((n) => n.id === id);
    if (!target) return;

    snapshotBoard();
    const dupNode: MindmapNode = {
      ...target,
      id: 'node_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      x: target.x + 40,
      y: target.y + 40,
      title: `${target.title} (Copy)`,
    };

    updateActiveBoard((b) => ({
      ...b,
      nodes: [...b.nodes, dupNode],
    }));
    setSelectedNodeId(dupNode.id);
  };

  const handleDeleteEdge = (edgeId: string) => {
    snapshotBoard();
    updateActiveBoard((b) => ({
      ...b,
      edges: b.edges.filter((e) => e.id !== edgeId),
    }));
    if (selectedEdgeId === edgeId) setSelectedEdgeId(null);
  };

  // Find nearest connection port with a 60px magnetic snap proximity
  const findBestTargetPort = (
    cursorWorldX: number,
    cursorWorldY: number,
    fromNodeId: string
  ): { targetNodeId: string; targetHandle: 'top' | 'right' | 'bottom' | 'left' } | null => {
    let closestDist = 60; // 60px magnetic snap radius
    let result: { targetNodeId: string; targetHandle: 'top' | 'right' | 'bottom' | 'left' } | null = null;

    for (const node of activeBoard.nodes) {
      if (node.id === fromNodeId) continue;

      const ports: { handle: 'top' | 'right' | 'bottom' | 'left'; x: number; y: number }[] = [
        { handle: 'top', x: node.x + node.width / 2, y: node.y },
        { handle: 'right', x: node.x + node.width, y: node.y + node.height / 2 },
        { handle: 'bottom', x: node.x + node.width / 2, y: node.y + node.height },
        { handle: 'left', x: node.x, y: node.y + node.height / 2 },
      ];

      for (const p of ports) {
        const dist = Math.hypot(cursorWorldX - p.x, cursorWorldY - p.y);
        if (dist < closestDist) {
          closestDist = dist;
          result = { targetNodeId: node.id, targetHandle: p.handle };
        }
      }
    }

    return result;
  };

  // Connect Drag Start
  const handleStartConnect = (
    nodeId: string,
    handle: 'top' | 'right' | 'bottom' | 'left',
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    const canvasBounds = canvasRef.current?.getBoundingClientRect();
    if (!canvasBounds) return;

    const worldX = (e.clientX - canvasBounds.left - pan.x) / zoom;
    const worldY = (e.clientY - canvasBounds.top - pan.y) / zoom;

    setDraftEdge({
      fromNodeId: nodeId,
      fromHandle: handle,
      cursorX: worldX,
      cursorY: worldY,
    });
  };

  // Node Dragging Start
  const handleStartDrag = (nodeId: string, e: React.MouseEvent) => {
    const node = activeBoard.nodes.find((n) => n.id === nodeId);
    if (!node) return;

    snapshotBoard();
    setDraggingNodeId(nodeId);
    dragStartPosRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      nodeX: node.x,
      nodeY: node.y,
    };
  };

  // Node Resize Start
  const handleStartResize = (nodeId: string, direction: string, e: React.MouseEvent) => {
    const node = activeBoard.nodes.find((n) => n.id === nodeId);
    if (!node) return;

    snapshotBoard();
    setResizingNodeId(nodeId);
    resizeDirectionRef.current = direction;
    resizeStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      x: node.x,
      y: node.y,
      w: node.width,
      h: node.height,
    };
  };

  // Canvas Mouse Down (Panning)
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.target === canvasRef.current || (e.target as HTMLElement).classList.contains(styles.worldLayer)) {
      setIsPanning(true);
      panStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
      setSelectedNodeId(null);
      setSelectedEdgeId(null);
    }
  };

  // Window Mouse Move & Up for Smooth Dragging, Panning, Resizing, and Edge Drawing
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      // 1. Panning Canvas
      if (isPanning) {
        setPan({
          x: e.clientX - panStartRef.current.x,
          y: e.clientY - panStartRef.current.y,
        });
        return;
      }

      // 2. Dragging Node
      if (draggingNodeId) {
        const dx = (e.clientX - dragStartPosRef.current.mouseX) / zoom;
        const dy = (e.clientY - dragStartPosRef.current.mouseY) / zoom;

        updateActiveBoard((b) => ({
          ...b,
          nodes: b.nodes.map((n) =>
            n.id === draggingNodeId
              ? {
                  ...n,
                  x: Math.round(dragStartPosRef.current.nodeX + dx),
                  y: Math.round(dragStartPosRef.current.nodeY + dy),
                }
              : n
          ),
        }));
        return;
      }

      // 3. Resizing Node
      if (resizingNodeId) {
        const dx = (e.clientX - resizeStartRef.current.mouseX) / zoom;
        const dy = (e.clientY - resizeStartRef.current.mouseY) / zoom;
        const dir = resizeDirectionRef.current;
        const start = resizeStartRef.current;

        let newX = start.x;
        let newY = start.y;
        let newW = start.w;
        let newH = start.h;

        if (dir.includes('e')) newW = Math.max(140, start.w + dx);
        if (dir.includes('s')) newH = Math.max(100, start.h + dy);
        if (dir.includes('w')) {
          const potentialW = start.w - dx;
          if (potentialW >= 140) {
            newW = potentialW;
            newX = start.x + dx;
          }
        }
        if (dir.includes('n')) {
          const potentialH = start.h - dy;
          if (potentialH >= 100) {
            newH = potentialH;
            newY = start.y + dy;
          }
        }

        updateActiveBoard((b) => ({
          ...b,
          nodes: b.nodes.map((n) =>
            n.id === resizingNodeId
              ? {
                  ...n,
                  x: Math.round(newX),
                  y: Math.round(newY),
                  width: Math.round(newW),
                  height: Math.round(newH),
                }
              : n
          ),
        }));
        return;
      }

      // 4. Drawing Connection Arrow
      if (draftEdge) {
        const canvasBounds = canvasRef.current?.getBoundingClientRect();
        if (canvasBounds) {
          const worldX = (e.clientX - canvasBounds.left - pan.x) / zoom;
          const worldY = (e.clientY - canvasBounds.top - pan.y) / zoom;

          const snap = findBestTargetPort(worldX, worldY, draftEdge.fromNodeId);

          setDraftEdge((prev) =>
            prev
              ? {
                  ...prev,
                  cursorX: worldX,
                  cursorY: worldY,
                  targetNodeId: snap ? snap.targetNodeId : undefined,
                  targetHandle: snap ? snap.targetHandle : undefined,
                }
              : null
          );
        }
      }
    };

    const handleMouseUp = () => {
      setIsPanning(false);
      setDraggingNodeId(null);
      setResizingNodeId(null);

      // Finish edge connector creation
      if (draftEdge) {
        if (draftEdge.targetNodeId && draftEdge.targetNodeId !== draftEdge.fromNodeId) {
          const newEdge: MindmapEdge = {
            id: 'edge_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
            fromNodeId: draftEdge.fromNodeId,
            fromHandle: draftEdge.fromHandle,
            toNodeId: draftEdge.targetNodeId,
            toHandle: draftEdge.targetHandle || 'left',
            style: 'solid',
          };

          snapshotBoard();
          updateActiveBoard((b) => ({
            ...b,
            edges: [...b.edges, newEdge],
          }));
        }
        setDraftEdge(null);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isPanning, draggingNodeId, resizingNodeId, draftEdge, zoom, pan, activeBoard, updateActiveBoard, snapshotBoard]);

  // Zoom on wheel
  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
      const newZoom = Math.min(Math.max(zoom * zoomFactor, 0.25), 2.5);
      setZoom(newZoom);
      updateActiveBoard((b) => ({ ...b, zoom: newZoom }));
    } else {
      setPan((prev) => ({
        x: prev.x - e.deltaX * 0.8,
        y: prev.y - e.deltaY * 0.8,
      }));
    }
  };

  const handleResetZoom = () => {
    setZoom(1);
    setPan({ x: 100, y: 60 });
    updateActiveBoard((b) => ({ ...b, zoom: 1, pan: { x: 100, y: 60 } }));
  };

  const handleZoomIn = () => {
    const next = Math.min(zoom + 0.15, 2.5);
    setZoom(next);
    updateActiveBoard((b) => ({ ...b, zoom: next }));
  };

  const handleZoomOut = () => {
    const next = Math.max(zoom - 0.15, 0.25);
    setZoom(next);
    updateActiveBoard((b) => ({ ...b, zoom: next }));
  };

  // Keyboard Shortcuts (Delete, Esc, Undo/Redo)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      const isEditableTarget = ['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName);

      if (e.key === 'Escape') {
        if (selectedEdgeId) {
          setSelectedEdgeId(null);
        } else if (selectedNodeId) {
          setSelectedNodeId(null);
        } else if (aiModalOpen) {
          setAiModalOpen(false);
        } else {
          onClose();
        }
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !isEditableTarget) {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y' && !isEditableTarget) {
        e.preventDefault();
        handleRedo();
        return;
      }

      if ((e.key === 'Delete' || e.key === 'Backspace') && !isEditableTarget) {
        if (selectedEdgeId) {
          handleDeleteEdge(selectedEdgeId);
        } else if (selectedNodeId) {
          handleDeleteNode(selectedNodeId);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedEdgeId, selectedNodeId, aiModalOpen, onClose, handleUndo, handleRedo]);

  // Tree Auto-Layout
  const handleAutoLayout = () => {
    if (activeBoard.nodes.length === 0) return;

    snapshotBoard();
    const startNode = activeBoard.nodes[0];
    const visited = new Set<string>();
    const levelMap = new Map<string, number>();

    const assignLevels = (nodeId: string, level: number) => {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);
      levelMap.set(nodeId, level);

      const outgoing = activeBoard.edges.filter((e) => e.fromNodeId === nodeId);
      outgoing.forEach((edge) => assignLevels(edge.toNodeId, level + 1));
    };

    assignLevels(startNode.id, 0);

    // Unconnected nodes get placed below
    activeBoard.nodes.forEach((n) => {
      if (!levelMap.has(n.id)) levelMap.set(n.id, 0);
    });

    const levelCounts: Record<number, number> = {};
    const repositioned = activeBoard.nodes.map((node) => {
      const level = levelMap.get(node.id) || 0;
      const indexInLevel = levelCounts[level] || 0;
      levelCounts[level] = indexInLevel + 1;

      return {
        ...node,
        x: 100 + level * 340,
        y: 120 + indexInLevel * 220,
      };
    });

    updateActiveBoard((b) => ({ ...b, nodes: repositioned }));
  };

  // AI Expand
  const handleAIExpand = (node: MindmapNode) => {
    setTargetAiNode(node);
    setAiPrompt(`Generate 3 detailed sub-topics or execution steps for: "${node.title}"`);
    setAiModalOpen(true);
  };

  const handleExecuteAIExpand = () => {
    if (!targetAiNode) return;

    const colors: NodeColor[] = ['blue', 'purple', 'emerald', 'amber', 'rose'];
    const subTopics = [
      { title: `${targetAiNode.title} - Scope & Objectives`, desc: 'Core goals, attack surfaces, and validation rules.' },
      { title: `${targetAiNode.title} - Methodology`, desc: 'Step-by-step techniques and tool pipelines.' },
      { title: `${targetAiNode.title} - Risk & Remediation`, desc: 'CVSS calculation, hardening guides, and patches.' },
    ];

    const newNodes: MindmapNode[] = [];
    const newEdges: MindmapEdge[] = [];

    subTopics.forEach((topic, i) => {
      const subId = 'node_' + Date.now() + '_' + i;
      newNodes.push({
        id: subId,
        type: 'card',
        x: targetAiNode.x + targetAiNode.width + 120,
        y: targetAiNode.y + (i - 1) * 180,
        width: 240,
        height: 150,
        color: colors[i % colors.length],
        title: topic.title,
        content: topic.desc,
        zIndex: 10,
      });

      newEdges.push({
        id: 'edge_' + Date.now() + '_' + i,
        fromNodeId: targetAiNode.id,
        fromHandle: 'right',
        toNodeId: subId,
        toHandle: 'left',
        style: 'solid',
      });
    });

    snapshotBoard();
    updateActiveBoard((b) => ({
      ...b,
      nodes: [...b.nodes, ...newNodes],
      edges: [...b.edges, ...newEdges],
    }));

    setAiModalOpen(false);
  };

  // Export / Import JSON
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
      reader.onload = (loadEvt) => {
        try {
          const parsed = JSON.parse(loadEvt.target?.result as string);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setBoards(parsed);
            setActiveBoardId(parsed[0].id);
          }
        } catch {
          toast('error', 'Invalid Mindmap JSON file format');
        }
      };
      reader.readAsText(file);
    }
  };

  if (!isOpen) return null;

  const selectedEdge = activeBoard.edges.find((e) => e.id === selectedEdgeId);

  return (
    <div className={styles.overlay}>
      <MindmapTopBar
        boards={boards}
        activeBoardId={activeBoardId}
        onSelectBoard={setActiveBoardId}
        onAddBoard={handleAddBoard}
        onRenameBoard={handleRenameBoard}
        onDeleteBoard={handleDeleteBoard}
        onAddNode={handleAddNode}
        onAutoLayout={handleAutoLayout}
        onExportJson={handleExportJSON}
        onImportJson={() => fileImportRef.current?.click()}
        onOpenAiModal={() => {
          setTargetAiNode(activeBoard.nodes[0] || null);
          setAiPrompt('Generate branching nodes for this mindmap');
          setAiModalOpen(true);
        }}
        onClearCanvas={handleClearCurrentBoard}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={canUndo}
        canRedo={canRedo}
        zoom={zoom}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onResetZoom={handleResetZoom}
        onClose={onClose}
      />

      <input
        ref={fileImportRef}
        type="file"
        accept=".json"
        style={{ display: 'none' }}
        onChange={handleImportJSON}
      />

      {/* Infinite Canvas */}
      <div
        ref={canvasRef}
        className={styles.canvasContainer}
        onMouseDown={handleCanvasMouseDown}
        onWheel={handleWheel}
      >
        {/* Floating Zoom HUD */}
        <div className={styles.floatingHud}>
          <button className={styles.hudBtn} onClick={handleZoomOut} title="Zoom Out (Ctrl+Scroll)">
            <ZoomOut size={16} />
          </button>
          <span className={styles.zoomLabel}>{Math.round(zoom * 100)}%</span>
          <button className={styles.hudBtn} onClick={handleZoomIn} title="Zoom In (Ctrl+Scroll)">
            <ZoomIn size={16} />
          </button>
          <button className={styles.hudBtn} onClick={handleResetZoom} title="Reset Zoom">
            <Maximize2 size={14} />
          </button>
        </div>

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

        {/* Selected Edge Inspector Toolbar */}
        {selectedEdge && (
          <MindmapEdgeToolbar
            selectedEdge={selectedEdge}
            onUpdateEdge={(edgeId, updates) => {
              updateActiveBoard((b) => ({
                ...b,
                edges: b.edges.map((edge) =>
                  edge.id === edgeId ? { ...edge, ...updates } : edge
                ),
              }));
            }}
            onDeleteEdge={handleDeleteEdge}
            onDeselect={() => setSelectedEdgeId(null)}
          />
        )}
      </div>

      {/* AI Expansion Modal */}
      <MindmapAiModal
        isOpen={aiModalOpen}
        prompt={aiPrompt}
        onChangePrompt={setAiPrompt}
        onExecute={handleExecuteAIExpand}
        onClose={() => setAiModalOpen(false)}
      />
    </div>
  );
}
