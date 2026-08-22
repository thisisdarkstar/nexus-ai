export type MindmapNodeType = 'note' | 'card' | 'image' | 'frame';

export type NodeColor = 'emerald' | 'blue' | 'purple' | 'amber' | 'rose' | 'slate';

export interface MindmapChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export interface MindmapNode {
  id: string;
  type: MindmapNodeType;
  x: number;
  y: number;
  width: number;
  height: number;
  color: NodeColor;
  title?: string;
  content: string;
  tags?: string[];
  imageUrl?: string;
  parentId?: string;
  zIndex?: number;
  checklist?: MindmapChecklistItem[];
}

export interface MindmapEdge {
  id: string;
  fromNodeId: string;
  fromHandle?: 'top' | 'right' | 'bottom' | 'left';
  toNodeId: string;
  toHandle?: 'top' | 'right' | 'bottom' | 'left';
  label?: string;
  color?: string;
  style?: 'solid' | 'dashed' | 'dotted';
}

export interface MindmapBoard {
  id: string;
  name: string;
  nodes: MindmapNode[];
  edges: MindmapEdge[];
  zoom: number;
  pan: { x: number; y: number };
  createdAt: number;
  updatedAt: number;
}
