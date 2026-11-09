export type AssetNodeType =
  | 'domain'
  | 'subdomain'
  | 'ip_address'
  | 'port_service'
  | 'http_endpoint'
  | 'parameter'
  | 'technology'
  | 'source_file'
  | 'finding';

export type AssetEdgeType =
  | 'resolves_to'       // Subdomain -> IP
  | 'hosts_service'     // IP -> Port
  | 'exposes_route'     // Service/Host -> Endpoint
  | 'accepts_param'     // Endpoint -> Parameter
  | 'runs_tech'         // Endpoint/Host -> Technology
  | 'defined_in'        // Route -> SourceFile
  | 'exhibits_finding'; // Route/Param -> Finding

export interface GraphNode {
  id: string; // e.g., "ep:https://api.acme.corp/v1/users" or "dom:acme.corp"
  projectId: string;
  type: AssetNodeType;
  label: string;
  inScope: boolean;
  riskScore: number; // 0.0 - 100.0
  confidence: 'confirmed' | 'high_confidence' | 'tentative' | 'unverified';
  firstSeenAt: number;
  lastSeenAt: number;
  attributes: Record<string, any>;
  evidenceIds: string[];
}

export interface GraphEdge {
  id: string; // e.g., "edge:sub.acme.corp->10.0.1.5:resolves_to"
  projectId: string;
  sourceId: string;
  targetId: string;
  relationship: AssetEdgeType;
  metadata?: Record<string, any>;
}

export interface GraphSerialization {
  version: '1.0';
  projectId: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

