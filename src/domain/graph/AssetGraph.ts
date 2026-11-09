import { ScopeEvaluator } from '../assessment/ScopeEvaluator';
import type { ReconAsset, ScopeItem } from '../../types';
import type {
  AssetNodeType,
  AssetEdgeType,
  GraphNode,
  GraphEdge,
  GraphSerialization,
} from './types';

export class AssetGraph {
  private projectId: string;
  private nodes: Map<string, GraphNode> = new Map();
  private edges: Map<string, GraphEdge> = new Map();
  private outgoingIndex: Map<string, Set<string>> = new Map();
  private incomingIndex: Map<string, Set<string>> = new Map();

  constructor(projectId: string = 'default') {
    this.projectId = projectId;
  }

  public getProjectId(): string {
    return this.projectId;
  }

  public setProjectId(id: string): void {
    this.projectId = id;
  }

  public clear(): void {
    this.nodes.clear();
    this.edges.clear();
    this.outgoingIndex.clear();
    this.incomingIndex.clear();
  }

  public addNode(node: GraphNode): void {
    const existing = this.nodes.get(node.id);
    if (existing) {
      // Merge attributes & evidence
      existing.lastSeenAt = Math.max(existing.lastSeenAt, node.lastSeenAt);
      existing.riskScore = Math.max(existing.riskScore, node.riskScore);
      existing.attributes = { ...existing.attributes, ...node.attributes };
      existing.evidenceIds = Array.from(new Set([...existing.evidenceIds, ...node.evidenceIds]));
    } else {
      this.nodes.set(node.id, { ...node, projectId: this.projectId });
    }
  }

  public addEdge(edge: GraphEdge): void {
    const edgeKey = edge.id || `${edge.sourceId}->${edge.targetId}:${edge.relationship}`;
    const finalizedEdge: GraphEdge = {
      ...edge,
      id: edgeKey,
      projectId: this.projectId,
    };

    this.edges.set(edgeKey, finalizedEdge);

    // Update outgoing index
    if (!this.outgoingIndex.has(edge.sourceId)) {
      this.outgoingIndex.set(edge.sourceId, new Set());
    }
    this.outgoingIndex.get(edge.sourceId)!.add(edgeKey);

    // Update incoming index
    if (!this.incomingIndex.has(edge.targetId)) {
      this.incomingIndex.set(edge.targetId, new Set());
    }
    this.incomingIndex.get(edge.targetId)!.add(edgeKey);
  }

  public getNode(id: string): GraphNode | undefined {
    return this.nodes.get(id);
  }

  public getAllNodes(): GraphNode[] {
    return Array.from(this.nodes.values());
  }

  public getAllEdges(): GraphEdge[] {
    return Array.from(this.edges.values());
  }

  public getNodesByType(type: AssetNodeType): GraphNode[] {
    return Array.from(this.nodes.values()).filter((n) => n.type === type);
  }

  public getOutgoingEdges(nodeId: string, relationship?: AssetEdgeType): GraphEdge[] {
    const edgeIds = this.outgoingIndex.get(nodeId);
    if (!edgeIds) return [];

    const result: GraphEdge[] = [];
    for (const eid of edgeIds) {
      const edge = this.edges.get(eid);
      if (edge && (!relationship || edge.relationship === relationship)) {
        result.push(edge);
      }
    }
    return result;
  }

  public getIncomingEdges(nodeId: string, relationship?: AssetEdgeType): GraphEdge[] {
    const edgeIds = this.incomingIndex.get(nodeId);
    if (!edgeIds) return [];

    const result: GraphEdge[] = [];
    for (const eid of edgeIds) {
      const edge = this.edges.get(eid);
      if (edge && (!relationship || edge.relationship === relationship)) {
        result.push(edge);
      }
    }
    return result;
  }

  public getNeighbors(
    nodeId: string,
    direction: 'outgoing' | 'incoming' | 'both' = 'both',
    relationship?: AssetEdgeType
  ): GraphNode[] {
    const neighborIds = new Set<string>();

    if (direction === 'outgoing' || direction === 'both') {
      const outEdges = this.getOutgoingEdges(nodeId, relationship);
      outEdges.forEach((e) => neighborIds.add(e.targetId));
    }

    if (direction === 'incoming' || direction === 'both') {
      const inEdges = this.getIncomingEdges(nodeId, relationship);
      inEdges.forEach((e) => neighborIds.add(e.sourceId));
    }

    const neighbors: GraphNode[] = [];
    for (const id of neighborIds) {
      const n = this.nodes.get(id);
      if (n) neighbors.push(n);
    }
    return neighbors;
  }

  /**
   * Discovers all HTTP endpoints associated with a given technology name (e.g. "Spring Boot").
   */
  public findEndpointsForTechnology(techName: string): GraphNode[] {
    const techId = `tech:${techName.toLowerCase().trim()}`;
    const inEdges = this.getIncomingEdges(techId, 'runs_tech');
    const endpoints: GraphNode[] = [];

    for (const edge of inEdges) {
      const node = this.nodes.get(edge.sourceId);
      if (node && node.type === 'http_endpoint') {
        endpoints.push(node);
      }
    }
    return endpoints;
  }

  /**
   * Discovers all HTTP endpoints that accept a specified query/body parameter.
   */
  public findEndpointsForParameter(paramName: string): GraphNode[] {
    const paramId = `param:${paramName.toLowerCase().trim()}`;
    const inEdges = this.getIncomingEdges(paramId, 'accepts_param');
    const endpoints: GraphNode[] = [];

    for (const edge of inEdges) {
      const node = this.nodes.get(edge.sourceId);
      if (node && node.type === 'http_endpoint') {
        endpoints.push(node);
      }
    }
    return endpoints;
  }

  /**
   * Transforms flat ReconAsset records into a rich relational graph connecting
   * Domains, Subdomains, Endpoints, Parameters, and Technologies.
   */
  public buildFromFlatAssets(
    assets: ReconAsset[],
    projectId: string = this.projectId,
    scopeRules: ScopeItem[] = []
  ): void {
    this.projectId = projectId;
    const now = Date.now();

    for (const asset of assets) {
      const rawUrl = asset.url || `https://${asset.host}`;
      let parsedUrl: URL;
      try {
        parsedUrl = new URL(rawUrl);
      } catch {
        continue;
      }

      const hostname = parsedUrl.hostname.toLowerCase();
      const inScope =
        scopeRules.length > 0 ? ScopeEvaluator.isTargetInScope(rawUrl, scopeRules).inScope : true;

      // 1. Apex Domain Node
      const hostParts = hostname.split('.');
      const apexDomain = hostParts.length >= 2 ? hostParts.slice(-2).join('.') : hostname;
      const domainNodeId = `dom:${apexDomain}`;

      this.addNode({
        id: domainNodeId,
        projectId,
        type: 'domain',
        label: apexDomain,
        inScope,
        riskScore: 0,
        confidence: 'confirmed',
        firstSeenAt: now,
        lastSeenAt: now,
        attributes: {},
        evidenceIds: [],
      });

      // 2. Subdomain Node (if different from apex)
      const subNodeId = `sub:${hostname}`;
      this.addNode({
        id: subNodeId,
        projectId,
        type: 'subdomain',
        label: hostname,
        inScope,
        riskScore: asset.riskScore === 'critical' ? 90 : asset.riskScore === 'high' ? 70 : 20,
        confidence: 'confirmed',
        firstSeenAt: now,
        lastSeenAt: now,
        attributes: {
          port: asset.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
          webserver: asset.webserver,
        },
        evidenceIds: [],
      });

      // Connect Apex -> Subdomain
      this.addEdge({
        id: `${domainNodeId}->${subNodeId}:resolves_to`,
        projectId,
        sourceId: domainNodeId,
        targetId: subNodeId,
        relationship: 'resolves_to',
      });

      // 3. HTTP Endpoint Node
      const endpointNodeId = `ep:${rawUrl}`;
      this.addNode({
        id: endpointNodeId,
        projectId,
        type: 'http_endpoint',
        label: `${parsedUrl.pathname}${parsedUrl.search}`,
        inScope,
        riskScore:
          asset.riskScore === 'critical'
            ? 95
            : asset.riskScore === 'high'
              ? 75
              : asset.riskScore === 'medium'
                ? 50
                : 15,
        confidence: 'confirmed',
        firstSeenAt: now,
        lastSeenAt: now,
        attributes: {
          statusCode: asset.statusCode,
          contentType: asset.contentType,
          title: asset.title,
          highInterestFlags: asset.highInterestFlags || [],
        },
        evidenceIds: [],
      });

      // Connect Subdomain -> Endpoint
      this.addEdge({
        id: `${subNodeId}->${endpointNodeId}:exposes_route`,
        projectId,
        sourceId: subNodeId,
        targetId: endpointNodeId,
        relationship: 'exposes_route',
      });

      // 4. Parameter Nodes
      parsedUrl.searchParams.forEach((val, paramName) => {
        const paramId = `param:${paramName.toLowerCase()}`;
        this.addNode({
          id: paramId,
          projectId,
          type: 'parameter',
          label: paramName,
          inScope,
          riskScore: ['id', 'url', 'dest', 'redirect', 'token', 'key'].includes(
            paramName.toLowerCase()
          )
            ? 70
            : 10,
          confidence: 'confirmed',
          firstSeenAt: now,
          lastSeenAt: now,
          attributes: { sampleValue: val },
          evidenceIds: [],
        });

        this.addEdge({
          id: `${endpointNodeId}->${paramId}:accepts_param`,
          projectId,
          sourceId: endpointNodeId,
          targetId: paramId,
          relationship: 'accepts_param',
        });
      });

      // 5. Technology Nodes
      const techs = asset.technologies || [];
      for (const t of techs) {
        const techId = `tech:${t.toLowerCase().trim()}`;
        this.addNode({
          id: techId,
          projectId,
          type: 'technology',
          label: t,
          inScope: true,
          riskScore: t.toLowerCase().includes('actuator') ? 85 : 0,
          confidence: 'confirmed',
          firstSeenAt: now,
          lastSeenAt: now,
          attributes: {},
          evidenceIds: [],
        });

        this.addEdge({
          id: `${endpointNodeId}->${techId}:runs_tech`,
          projectId,
          sourceId: endpointNodeId,
          targetId: techId,
          relationship: 'runs_tech',
        });
      }
    }
  }

  public toJSON(): GraphSerialization {
    return {
      version: '1.0',
      projectId: this.projectId,
      nodes: this.getAllNodes(),
      edges: this.getAllEdges(),
    };
  }

  public fromJSON(data: GraphSerialization): void {
    this.clear();
    this.projectId = data.projectId;
    data.nodes.forEach((n) => this.addNode(n));
    data.edges.forEach((e) => this.addEdge(e));
  }
}
