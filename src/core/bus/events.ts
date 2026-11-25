import type {
  VulnerabilityFinding,
  ScopeItem,
  ReconAsset,
  SecurityTab,
  CVSSMetrics,
} from '../../types';

export interface SecurityEventMap {
  // Vulnerability Findings & Reports
  'finding:added': { finding: VulnerabilityFinding; projectId?: string };
  'finding:updated': { findingId: string; patch: Partial<VulnerabilityFinding> };
  'finding:deleted': { findingId: string };
  'report:reset': { projectId?: string };

  // Scope & Boundary Enforcement
  'scope:added': { items: ScopeItem[]; projectId?: string };
  'scope:updated': { id: string; patch: Partial<ScopeItem> };
  'scope:deleted': { id: string };

  // Reconnaissance & Asset Inventory
  'recon:assets-added': { assets: ReconAsset[]; projectId?: string };
  'recon:target-changed': { targetDomain: string; projectId?: string };

  // Cross-Module Workbench Routing
  'workbench:switch-tab': {
    tab: SecurityTab;
    extra?: {
      code?: string;
      input?: string;
      rawHttp?: string;
    };
  };

  // HTTP Studio Bridges
  'http:load-request': { rawHttp: string };

  // Nuclei Template Studio Bridges
  'nuclei:load-template': {
    templateId?: string;
    name?: string;
    path?: string;
    severity?: 'critical' | 'high' | 'medium' | 'low' | 'info';
    tags?: string;
    description?: string;
    method?: string;
    matcherWords?: string;
  };

  // Compliance & Checklists
  'checklist:updated': {
    testId: string;
    status: 'pass' | 'fail' | 'untested' | 'na';
    evidence?: string;
  };

  // SAST Code Auditor
  'audit:load-code': { code: string; language?: string };

  // Project & Workspace Context
  'project:switched': { projectId: string; previousProjectId?: string };

  // Shell-level routing (formerly raw window CustomEvents)
  'open-security': { tab?: SecurityTab; code?: string; input?: string };
  'open-ingest': void;
  'open-quick-hud': { query?: string } | void;

  // Notes & Attack Mindmap Studio bridges
  'notemap:open': { mode?: 'mindmap' | 'note' | 'split'; createMode?: 'mindmap' | 'note' } | void;
  'notemap:add-node': {
    text: string;
    tag?: string;
    notes?: string;
    accent?: 'slate' | 'emerald' | 'sky' | 'amber' | 'rose' | 'violet';
  };

  // WorkbenchBridge domain events
  'workbench:add-finding': VulnerabilityFinding;
  'workbench:add-scope': ScopeItem[];
  'workbench:add-recon-assets': ReconAsset[];
  'workbench:update-checklist': {
    testId: string;
    status: 'pass' | 'fail' | 'untested' | 'na';
    evidence?: string;
  };
  'workbench:load-http': { rawHttp: string };
  'workbench:load-nuclei': {
    templateId?: string;
    name?: string;
    path?: string;
    severity?: 'critical' | 'high' | 'medium' | 'low' | 'info';
    tags?: string;
    description?: string;
    method?: string;
    matcherWords?: string;
  };
}

