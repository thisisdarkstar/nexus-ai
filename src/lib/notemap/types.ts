export type NoteMapViewMode = 'mindmap' | 'note' | 'split';

export type MindmapLayoutMode = 'right' | 'down' | 'balanced' | 'radial';

export type NodeAccent = 'slate' | 'emerald' | 'sky' | 'amber' | 'rose' | 'violet';

export interface Point {
  x: number;
  y: number;
}

export interface NodeSize {
  width: number;
  height: number;
}

export interface MindmapNode {
  id: string;
  parentId: string | null;
  text: string;
  notes?: string;
  position: Point;
  size: NodeSize;
  accent: NodeAccent;
  collapsed?: boolean;
  childOrder: string[];
  tag?: string;
}

export interface MindmapEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  dashed?: boolean;
}

export interface MindmapState {
  nodes: Record<string, MindmapNode>;
  edges: Record<string, MindmapEdge>;
  layout: MindmapLayoutMode;
}

export interface NoteMapDocument {
  id: string;
  title: string;
  mode: NoteMapViewMode;
  tags: string[];
  noteContent: string;
  mindmap: MindmapState;
  createdAt: number;
  updatedAt: number;
  pinned?: boolean;
}

export interface NoteMapWorkspaceData {
  version: 1;
  activeDocId: string | null;
  documents: NoteMapDocument[];
}
