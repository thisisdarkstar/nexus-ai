import { storageManager } from './StorageManager';
import type { ReconAsset, ScopeItem, VulnerabilityFinding } from '../../types';

const MIGRATION_FLAG_KEY = 'nexus_security_migrated_v2';

/**
 * Transparent One-Time Migration:
 * Migrates unpartitioned legacy localStorage state into IndexedDB.
 */
export async function runStorageMigration(targetProjectId: string = 'default'): Promise<{ migrated: boolean; counts: Record<string, number> }> {
  try {
    const isMigrated = localStorage.getItem(MIGRATION_FLAG_KEY);
    if (isMigrated === 'true') {
      return { migrated: false, counts: {} };
    }

    const counts: Record<string, number> = {
      assets: 0,
      findings: 0,
      scope: 0,
    };

    // 1. Migrate Recon Assets
    const rawAssets = localStorage.getItem('nexus_security_recon_assets');
    if (rawAssets) {
      try {
        const assets: ReconAsset[] = JSON.parse(rawAssets);
        if (Array.isArray(assets) && assets.length > 0) {
          await storageManager.saveAssets(
            assets.map((a) => ({
              ...a,
              projectId: targetProjectId,
              createdAt: a.createdAt || Date.now(),
            }))
          );
          counts.assets = assets.length;
        }
      } catch (err) {
        console.error('Failed to migrate recon assets:', err);
      }
    }

    // 2. Migrate Scope Items
    const rawScope = localStorage.getItem('nexus_security_scope');
    if (rawScope) {
      try {
        const scope: ScopeItem[] = JSON.parse(rawScope);
        if (Array.isArray(scope) && scope.length > 0) {
          await storageManager.saveScope(scope, targetProjectId);
          counts.scope = scope.length;
        }
      } catch (err) {
        console.error('Failed to migrate scope items:', err);
      }
    }

    // 3. Migrate Report Findings
    const rawReport = localStorage.getItem('nexus_security_report');
    if (rawReport) {
      try {
        const report = JSON.parse(rawReport);
        if (report && Array.isArray(report.findings)) {
          for (const finding of report.findings as VulnerabilityFinding[]) {
            await storageManager.saveFinding({
              id: finding.id || `migrated-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              projectId: targetProjectId,
              title: finding.title || 'Untitled Finding',
              severity: finding.severity || 'medium',
              cweId: finding.cweId,
              owaspCategory: finding.owaspCategory,
              targetEndpoint: finding.targetEndpoint,
              description: finding.description || '',
              remediation: finding.remediation || '',
              status: finding.status || 'open',
              cvss: finding.cvss ? {
                score: finding.cvss.score,
                vectorString: finding.cvss.vectorString,
                version: finding.cvss.version,
              } : undefined,
              createdAt: Date.now(),
              updatedAt: Date.now(),
            });
            counts.findings++;
          }
        }
      } catch (err) {
        console.error('Failed to migrate report findings:', err);
      }
    }

    // Mark as migrated
    localStorage.setItem(MIGRATION_FLAG_KEY, 'true');
    return { migrated: true, counts };
  } catch (e) {
    console.error('Storage migration failed:', e);
    return { migrated: false, counts: {} };
  }
}
