import type { VulnerabilityFinding, ScopeItem, SecurityTab, ReconAsset } from '../../types';

export interface WorkbenchEvents {
  'nexus:workbench:add-finding': VulnerabilityFinding;
  'nexus:workbench:add-scope': ScopeItem[];
  'nexus:workbench:add-recon-assets': ReconAsset[];
  'nexus:workbench:update-checklist': { testId: string; status: 'pass' | 'fail' | 'untested' | 'na'; evidence?: string };
  'nexus:workbench:load-http': string;
  'nexus:workbench:load-audit-code': { code: string; language?: string };
}

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
      const saved = localStorage.getItem(REPORT_STORAGE_KEY);
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

      localStorage.setItem(REPORT_STORAGE_KEY, JSON.stringify(report));

      window.dispatchEvent(
        new CustomEvent('nexus:workbench:add-finding', { detail: uniqueFinding })
      );
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
      const saved = localStorage.getItem(SCOPE_STORAGE_KEY);
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

      localStorage.setItem(SCOPE_STORAGE_KEY, JSON.stringify(updated));

      window.dispatchEvent(
        new CustomEvent('nexus:workbench:add-scope', { detail: items })
      );
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
      const saved = localStorage.getItem(RECON_STORAGE_KEY);
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

      localStorage.setItem(RECON_STORAGE_KEY, JSON.stringify(updated));

      window.dispatchEvent(
        new CustomEvent('nexus:workbench:add-recon-assets', { detail: assets })
      );
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
      const saved = localStorage.getItem(RECON_STORAGE_KEY);
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
      window.dispatchEvent(
        new CustomEvent('nexus:workbench:update-checklist', {
          detail: { testId, status, evidence },
        })
      );
    } catch (e) {
      console.error('Failed to update checklist item via workbenchBridge:', e);
    }
  }

  /**
   * Load raw HTTP request into HTTP Studio and switch tab
   */
  public loadHttp(rawHttp: string): void {
    try {
      localStorage.setItem('nexus_security_http_request', rawHttp);
      window.dispatchEvent(
        new CustomEvent('nexus:open-security', {
          detail: { tab: 'http_studio' },
        })
      );
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
      localStorage.setItem('nexus_security_nuclei_preset', JSON.stringify(template));
      window.dispatchEvent(
        new CustomEvent('nexus:workbench:load-nuclei', { detail: template })
      );
      this.switchTab('nuclei');
    } catch (e) {
      console.error('Failed to load nuclei template via workbenchBridge:', e);
    }
  }

  /**
   * Switch the active security workbench tab
   */
  public switchTab(tab: SecurityTab, extra?: { code?: string; input?: string }): void {
    window.dispatchEvent(
      new CustomEvent('nexus:open-security', {
        detail: { tab, ...extra },
      })
    );
  }
}

export const workbenchBridge = WorkbenchBridge.getInstance();

