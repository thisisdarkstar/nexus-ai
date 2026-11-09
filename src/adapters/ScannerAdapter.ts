import type { GraphNode, GraphEdge } from '../domain/graph/types';
import type { VulnerabilityFinding, ScopeItem } from '../types';

export interface ScanParseContext {
  projectId: string;
  scopeRules?: ScopeItem[];
}

export interface ParsedScanOutput {
  nodes: GraphNode[];
  edges: GraphEdge[];
  findings: VulnerabilityFinding[];
}

export interface ScannerAdapter {
  id: string;
  name: string;
  format: 'nuclei_jsonl' | 'semgrep_sarif' | 'reconftw_dir' | 'zap_json' | 'generic';
  canParse(content: string, filename?: string): boolean;
  parse(content: string, context: ScanParseContext): Promise<ParsedScanOutput>;
}

export class ScannerAdapterRegistry {
  private static instance: ScannerAdapterRegistry;
  private adapters: Map<string, ScannerAdapter> = new Map();

  private constructor() {}

  public static getInstance(): ScannerAdapterRegistry {
    if (!ScannerAdapterRegistry.instance) {
      ScannerAdapterRegistry.instance = new ScannerAdapterRegistry();
    }
    return ScannerAdapterRegistry.instance;
  }

  public register(adapter: ScannerAdapter): void {
    this.adapters.set(adapter.id, adapter);
  }

  public getAdapter(id: string): ScannerAdapter | undefined {
    return this.adapters.get(id);
  }

  public getAllAdapters(): ScannerAdapter[] {
    return Array.from(this.adapters.values());
  }

  /**
   * Automatically detects the appropriate adapter for a given input payload.
   */
  public detectAdapter(content: string, filename?: string): ScannerAdapter | undefined {
    for (const adapter of this.adapters.values()) {
      if (adapter.canParse(content, filename)) {
        return adapter;
      }
    }
    return undefined;
  }
}

export const scannerAdapterRegistry = ScannerAdapterRegistry.getInstance();

