import { projectLocalStorage } from '../../core/storage/projectStorage';
import { db } from '../db';
import { workbenchBridge } from './workbenchBridge';
import { storageManager } from '../../core/storage/StorageManager';
import { evidenceVault } from '../../domain/evidence/EvidenceVault';
import { eventBus } from '../../core/bus/EventBus';
import type { Chat, Project, ScopeItem, SecurityChecklistItem, VAPTReport, ReconAsset } from '../../types';

export interface NexusEngagementBundle {
  version: '1.0.0';
  exportedAt: number;
  project: Project;
  report?: VAPTReport;
  scopeItems?: ScopeItem[];
  checklistItems?: SecurityChecklistItem[];
  chats?: Chat[];
  httpRequest?: string;
  reconAssets?: ReconAsset[];
  evidence?: any[];
  notemap?: unknown;
  apiStudio?: unknown;
  codeAuditor?: unknown;
  sandbox?: unknown;
  knowledgeBase?: unknown;
  vaultDocs?: unknown[];
}

/**
 * Export current workspace/engagement as a portable .nexus bundle
 */
export async function exportEngagementBundle(currentProjectId: string = 'default'): Promise<void> {
  const projects = await db.getProjects();
  const project = projects.find((p) => p.id === currentProjectId) || {
    id: currentProjectId,
    name: 'Default Engagement',
    createdAt: Date.now(),
  };

  const allChats = await db.getChats();
  const workspaceChats = allChats.filter((c) => (c.workspaceId || 'default') === currentProjectId);

  let report: VAPTReport | undefined;
  try {
    const raw = projectLocalStorage.getItem('nexus_security_report');
    if (raw) report = JSON.parse(raw);
  } catch {
    // ignore
  }

  let scopeItems: ScopeItem[] | undefined;
  try {
    const raw = projectLocalStorage.getItem('nexus_security_scope');
    if (raw) scopeItems = JSON.parse(raw);
  } catch {
    // ignore
  }

  let checklistItems: SecurityChecklistItem[] | undefined;
  try {
    const raw = projectLocalStorage.getItem('nexus_security_checklist');
    if (raw) checklistItems = JSON.parse(raw);
  } catch {
    // ignore
  }

  let reconAssets: ReconAsset[] | undefined;
  try {
    const idbAssets = await storageManager.getAssets(currentProjectId);
    if (idbAssets && idbAssets.length > 0) {
      reconAssets = idbAssets as unknown as ReconAsset[];
    } else {
      const raw = projectLocalStorage.getItem('nexus_security_recon_assets');
      if (raw) reconAssets = JSON.parse(raw);
    }
  } catch {
    // ignore
  }

  let evidence: any[] | undefined;
  try {
    evidence = await evidenceVault.getEvidence(currentProjectId);
  } catch {
    // ignore
  }

  const httpRequest = projectLocalStorage.getItem('nexus_security_http_request') || undefined;

  const readJson = (key: string) => {
    try {
      const raw = projectLocalStorage.getItem(key);
      return raw ? JSON.parse(raw) : undefined;
    } catch {
      return undefined;
    }
  };

  const bundle: NexusEngagementBundle = {
    version: '1.0.0',
    exportedAt: Date.now(),
    project,
    report,
    scopeItems,
    checklistItems,
    chats: workspaceChats,
    httpRequest,
    reconAssets,
    evidence,
    notemap: readJson('nexus_security_notemap_v1'),
    apiStudio: readJson('nexus_security_api_studio_v1'),
    codeAuditor: readJson('nexus_security_code_auditor_v1'),
    sandbox: readJson('nexus_security_sandbox_v1'),
    knowledgeBase: readJson('nexus_security_kb_v1'),
    vaultDocs: readJson('nexus_copilot_vault_docs_v1'),
  };

  const json = JSON.stringify(bundle, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safeName = project.name.replace(/[^a-zA-Z0-9_\-]/g, '_').toLowerCase();
  a.href = url;
  a.download = `engagement-${safeName}-${new Date().toISOString().slice(0, 10)}.nexus`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Import a .nexus bundle and restore the engagement into the workspace
 */
export async function importEngagementBundle(file: File): Promise<{
  projectName: string;
  chatsCount: number;
  findingsCount: number;
  scopeCount: number;
}> {
  const text = await file.text();
  const bundle = JSON.parse(text) as NexusEngagementBundle;

  if (!bundle.project || !bundle.project.name) {
    throw new Error('Invalid .nexus bundle: Missing project metadata.');
  }

  // 1. Save Project
  await db.saveProject(bundle.project);

  // 2. Save Chats
  let chatsCount = 0;
  if (bundle.chats && Array.isArray(bundle.chats)) {
    for (const chat of bundle.chats) {
      await db.saveChat(chat);
      chatsCount++;
    }
  }

  // 3. Restore Scope Items
  let scopeCount = 0;
  if (bundle.scopeItems && Array.isArray(bundle.scopeItems)) {
    workbenchBridge.addScopeItems(bundle.scopeItems);
    scopeCount = bundle.scopeItems.length;
  }

  // 4. Restore Findings / Report
  let findingsCount = 0;
  if (bundle.report) {
    projectLocalStorage.setItem('nexus_security_report', JSON.stringify(bundle.report));
    if (bundle.report.findings) {
      findingsCount = bundle.report.findings.length;
      bundle.report.findings.forEach((f) => workbenchBridge.addFinding(f));
    }
  }

  // 5. Restore Checklist
  if (bundle.checklistItems && Array.isArray(bundle.checklistItems)) {
    projectLocalStorage.setItem('nexus_security_checklist', JSON.stringify(bundle.checklistItems));
  }

  // 6. Restore HTTP Request
  if (bundle.httpRequest) {
    workbenchBridge.loadHttp(bundle.httpRequest);
  }

  // 7. Restore extended engagement modules & notes/vault
  const restoreJson = (key: string, value: unknown) => {
    if (value !== undefined) {
      projectLocalStorage.setItem(key, JSON.stringify(value));
    }
  };
  restoreJson('nexus_security_notemap_v1', bundle.notemap);
  restoreJson('nexus_security_api_studio_v1', bundle.apiStudio);
  restoreJson('nexus_security_code_auditor_v1', bundle.codeAuditor);
  restoreJson('nexus_security_sandbox_v1', bundle.sandbox);
  restoreJson('nexus_security_kb_v1', bundle.knowledgeBase);
  restoreJson('nexus_copilot_vault_docs_v1', bundle.vaultDocs);

  // 7. Restore Recon Assets (Fixing Line 48 Data Loss liability)
  if (bundle.reconAssets && Array.isArray(bundle.reconAssets)) {
    try {
      await storageManager.saveAssets(
        bundle.reconAssets.map((a) => ({
          ...a,
          createdAt: a.createdAt || Date.now(),
          projectId: bundle.project.id,
        }))
      );
      eventBus.publish('recon:assets-added', {
        assets: bundle.reconAssets,
        projectId: bundle.project.id,
      });
    } catch {
      // ignore
    }
  }

  return {
    projectName: bundle.project.name,
    chatsCount,
    findingsCount,
    scopeCount,
  };
}

