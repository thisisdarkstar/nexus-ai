import { eventBus } from '../../core/bus/EventBus';
import { projectLocalStorage } from '../../core/storage/projectStorage';
import {
  appendNodeToWorkspace,
  loadNoteMapWorkspace,
} from '../notemap/storage';
import type { VulnerabilityFinding, ScopeItem, SecurityTab, ReconAsset } from '../../types';

class WorkbenchBridge {
  private static instance: WorkbenchBridge;

  private constructor() {}

  public static getInstance(): WorkbenchBridge {
    if (!WorkbenchBridge.instance) {
      WorkbenchBridge.instance = new WorkbenchBridge();
    }
    return WorkbenchBridge.instance;
  }

  /**
   * Add a vulnerability finding to ReportStudio and persistent storage
   */
  public addFinding(finding: Omit<VulnerabilityFinding, 'id'> & { id?: string }): void {
    try {
      const REPORT_STORAGE_KEY = 'nexus_security_report';
      const saved = projectLocalStorage.getItem(REPORT_STORAGE_KEY);
      const report = saved ? JSON.parse(saved) : { findings: [] };

      // Ensure finding has unique id
      const uniqueFinding: VulnerabilityFinding = {
        ...finding,
        id: finding.id || `f-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        status: finding.status || 'open',
      };

      const existingIndex = report.findings?.findIndex((f: VulnerabilityFinding) => f.title === uniqueFinding.title);
      if (existingIndex >= 0) {
        report.findings[existingIndex] = { ...report.findings[existingIndex], ...uniqueFinding };
      } else {
        report.findings = [uniqueFinding, ...(report.findings || [])];
      }

      projectLocalStorage.setItem(REPORT_STORAGE_KEY, JSON.stringify(report));

      eventBus.publish('workbench:add-finding', uniqueFinding);
    } catch (e) {
      console.error('Failed to save finding via workbenchBridge:', e);
    }
  }

  /**
   * Add scope targets to ScopeManager and persistent storage
   */
  public addScopeItems(items: ScopeItem[]): void {
    try {
      const SCOPE_STORAGE_KEY = 'nexus_security_scope';
      const saved = projectLocalStorage.getItem(SCOPE_STORAGE_KEY);
      const existing: ScopeItem[] = saved ? JSON.parse(saved) : [];

      const updated = [...existing];
      items.forEach((item) => {
        const idx = updated.findIndex((s) => s.target.toLowerCase() === item.target.toLowerCase());
        if (idx >= 0) {
          updated[idx] = { ...updated[idx], ...item };
        } else {
          updated.push({
            ...item,
            id: item.id || `scope-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          });
        }
      });

      projectLocalStorage.setItem(SCOPE_STORAGE_KEY, JSON.stringify(updated));

      eventBus.publish('workbench:add-scope', items);
    } catch (e) {
      console.error('Failed to save scope items via workbenchBridge:', e);
    }
  }

  /**
   * Add recon assets to persistent storage and dispatch event
   */
  public addReconAssets(assets: ReconAsset[]): void {
    try {
      const RECON_STORAGE_KEY = 'nexus_security_recon_assets';
      const saved = projectLocalStorage.getItem(RECON_STORAGE_KEY);
      const existing: ReconAsset[] = saved ? JSON.parse(saved) : [];

      const updated = [...existing];
      assets.forEach((asset) => {
        const idx = updated.findIndex((a) => a.url.toLowerCase() === asset.url.toLowerCase());
        if (idx >= 0) {
          updated[idx] = { ...updated[idx], ...asset };
        } else {
          updated.push({
            ...asset,
            id: asset.id || `asset-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            createdAt: asset.createdAt || Date.now(),
          });
        }
      });

      projectLocalStorage.setItem(RECON_STORAGE_KEY, JSON.stringify(updated));

      eventBus.publish('workbench:add-recon-assets', assets);
    } catch (e) {
      console.error('Failed to save recon assets via workbenchBridge:', e);
    }
  }

  /**
   * Retrieve stored recon assets
   */
  public getReconAssets(): ReconAsset[] {
    try {
      const RECON_STORAGE_KEY = 'nexus_security_recon_assets';
      const saved = projectLocalStorage.getItem(RECON_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  }

  /**
   * Update an OWASP checklist item status
   */
  public updateChecklistItem(testId: string, status: 'pass' | 'fail' | 'untested' | 'na', evidence?: string): void {
    try {
      eventBus.publish('workbench:update-checklist', { testId, status, evidence });
    } catch (e) {
      console.error('Failed to update checklist item via workbenchBridge:', e);
    }
  }

  /**
   * Load raw HTTP request into HTTP Studio and switch tab
   */
  public loadHttp(rawHttp: string): void {
    try {
      projectLocalStorage.setItem('nexus_security_http_request', rawHttp);
      eventBus.publish('workbench:load-http', { rawHttp });
      eventBus.publish('open-security', { tab: 'http_studio' });
    } catch (e) {
      console.error('Failed to load HTTP snippet via workbenchBridge:', e);
    }
  }

  /**
   * Load Nuclei template into Nuclei Studio and switch tab
   */
  public loadNuclei(template: {
    templateId?: string;
    name?: string;
    path?: string;
    severity?: 'critical' | 'high' | 'medium' | 'low' | 'info';
    tags?: string;
    description?: string;
    method?: string;
    matcherWords?: string;
  }): void {
    try {
      projectLocalStorage.setItem('nexus_security_nuclei_preset', JSON.stringify(template));
      eventBus.publish('workbench:load-nuclei', template);
      this.switchTab('nuclei');
    } catch (e) {
      console.error('Failed to load nuclei template via workbenchBridge:', e);
    }
  }

  /**
   * Switch the active security workbench tab
   */
  public switchTab(tab: SecurityTab, extra?: { code?: string; input?: string }): void {
    eventBus.publish('open-security', { tab, ...extra });
  }

  /**
   * Open the floating Notes & Attack Mindmap Studio
   */
  public openNoteMap(options?: {
    mode?: 'mindmap' | 'note' | 'split';
    createMode?: 'mindmap' | 'note';
  }): void {
    eventBus.publish('notemap:open', options);
  }

  /**
   * Add a security finding, asset, or payload directly into the active engagement Mindmap
   */
  public addNodeToMindmap(payload: {
    text: string;
    tag?: string;
    notes?: string;
    accent?: 'slate' | 'emerald' | 'sky' | 'amber' | 'rose' | 'violet';
  }): void {
    try {
      const current = loadNoteMapWorkspace();
      appendNodeToWorkspace(current, payload);
      eventBus.publish('notemap:add-node', payload);
    } catch (e) {
      console.error('Failed to add node to mindmap via workbenchBridge:', e);
    }
  }
}

export const workbenchBridge = WorkbenchBridge.getInstance();

