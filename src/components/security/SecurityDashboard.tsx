import { useState, useEffect } from 'react';
import {
  Activity,
  ShieldAlert,
  Target,
  FileText,
  Lock,
  Download,
  Upload,
  Sparkles,
  Layers,
  CheckCircle,
  ExternalLink,
  ChevronRight,
  Database,
  Terminal,
} from 'lucide-react';
import { storageManager } from '../../core/storage/StorageManager';
import { evidenceVault } from '../../domain/evidence/EvidenceVault';
import { eventBus } from '../../core/bus/EventBus';
import { useToast } from '../../lib/toast';
import type { SecurityTab, VulnerabilityFinding, ScopeItem, ReconAsset } from '../../types';
import styles from './SecurityDashboard.module.css';

interface SecurityDashboardProps {
  onTabChange?: (tab: SecurityTab) => void;
  onSendToAI?: (prompt: string) => void;
}

export default function SecurityDashboard({ onTabChange, onSendToAI }: SecurityDashboardProps) {
  const { toast } = useToast();
  const [projectId] = useState<string>('default');
  const [assets, setAssets] = useState<ReconAsset[]>([]);
  const [findings, setFindings] = useState<VulnerabilityFinding[]>([]);
  const [scope, setScope] = useState<ScopeItem[]>([]);
  const [evidenceCount, setEvidenceCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [storedAssets, storedFindings, storedScope, storedEvidence] = await Promise.all([
        storageManager.getAssets(projectId),
        storageManager.getFindings(projectId),
        storageManager.getScope(projectId),
        evidenceVault.getEvidence(projectId),
      ]);

      setAssets((storedAssets as unknown as ReconAsset[]) || []);
      setFindings((storedFindings as unknown as VulnerabilityFinding[]) || []);
      setScope(storedScope || []);
      setEvidenceCount(storedEvidence ? storedEvidence.length : 0);
    } catch (err) {
      console.error('Failed to load dashboard data from IndexedDB:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    // Listen to live events to keep dashboard synchronized
    const unsubFinding = eventBus.subscribe('finding:added', () => loadData());
    const unsubRecon = eventBus.subscribe('recon:assets-added', () => loadData());
    const unsubScope = eventBus.subscribe('scope:added', () => loadData());

    return () => {
      unsubFinding();
      unsubRecon();
      unsubScope();
    };
  }, [projectId]);

  // Calculations
  const criticalCount = findings.filter((f) => f.severity === 'critical').length;
  const highCount = findings.filter((f) => f.severity === 'high').length;
  const mediumCount = findings.filter((f) => f.severity === 'medium').length;
  const lowCount = findings.filter((f) => f.severity === 'low').length;
  const infoCount = findings.filter((f) => f.severity === 'info').length;

  const openCount = findings.filter((f) => !f.status || f.status === 'open').length;
  const triagedCount = findings.filter((f) => f.status === 'triaged').length;
  const fixedCount = findings.filter((f) => f.status === 'fixed').length;
  const retestedCount = findings.filter((f) => f.status === 'retested').length;

  const inScopeCount = scope.filter((s) => s.inScope).length;

  // Mean CVSS score
  const scoredFindings = findings.filter((f) => f.cvss && f.cvss.score);
  const meanCvss =
    scoredFindings.length > 0
      ? (scoredFindings.reduce((acc, f) => acc + (f.cvss?.score || 0), 0) / scoredFindings.length).toFixed(1)
      : 'N/A';

  // Technology distribution
  const techMap: Record<string, number> = {};
  assets.forEach((a) => {
    (a.technologies || []).forEach((t) => {
      techMap[t] = (techMap[t] || 0) + 1;
    });
  });
  const topTechnologies = Object.entries(techMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  // Export full project archive
  const handleExportArchive = async () => {
    const [storedAssets, storedFindings, storedScope, storedEvidence] = await Promise.all([
      storageManager.getAssets(projectId),
      storageManager.getFindings(projectId),
      storageManager.getScope(projectId),
      evidenceVault.getEvidence(projectId),
    ]);

    const archive = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      projectId,
      assets: storedAssets,
      findings: storedFindings,
      scope: storedScope,
      evidence: storedEvidence,
    };

    const blob = new Blob([JSON.stringify(archive, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nexus_project_${projectId}_${Date.now()}.nexus.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Import project archive
  const handleImportArchive = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const data = JSON.parse(text);

        if (Array.isArray(data.assets)) {
          await storageManager.saveAssets(
            data.assets.map((a: any) => ({ ...a, projectId }))
          );
        }
        if (Array.isArray(data.findings)) {
          await storageManager.saveFindings(
            data.findings.map((f: any) => ({ ...f, projectId }))
          );
        }
        if (Array.isArray(data.scope)) {
          await storageManager.saveScope(
            data.scope.map((s: any) => ({ ...s, projectId }))
          );
        }

        await loadData();
        toast('success', `Successfully imported project archive with ${data.findings?.length || 0} findings and ${data.assets?.length || 0} assets!`);
      } catch (err: any) {
        toast('error', `Failed to import archive: ${err.message}`);
      }
    };
    input.click();
  };

  return (
    <div className={styles.container}>
      {/* Top Header */}
      <div className={styles.header}>
        <div className={styles.titleArea}>
          <Activity size={28} className={styles.titleIcon} />
          <div>
            <h2 className={styles.title}>Engagement Security Posture Dashboard</h2>
            <p className={styles.subtitle}>
              Executive risk aggregation, vulnerability severity distribution & engagement project management
            </p>
          </div>
        </div>

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.btn}
            onClick={handleImportArchive}
            title="Import an existing .nexus.json engagement archive"
          >
            <Upload size={14} /> Import Archive
          </button>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnPrimary}`}
            onClick={handleExportArchive}
            title="Export complete project state into a portable JSON backup"
          >
            <Download size={14} /> Export Project (.nexus.json)
          </button>
          {onSendToAI && (
            <button
              type="button"
              className={styles.btn}
              onClick={() => {
                onSendToAI(
                  `As a Senior Cyber Risk Officer, review this security engagement posture summary:

Project ID: ${projectId}
Assets Discovered: ${assets.length}
In-Scope Defined: ${inScopeCount}
Total Vulnerabilities: ${findings.length} (Critical: ${criticalCount}, High: ${highCount}, Medium: ${mediumCount}, Low: ${lowCount})
Mean CVSS Score: ${meanCvss}
Remediation Progress: Open: ${openCount}, Triaged: ${triagedCount}, Fixed: ${fixedCount}, Retested: ${retestedCount}
Top Technologies: ${topTechnologies.map((t) => `${t[0]} (${t[1]})`).join(', ') || 'N/A'}
Cryptographic Evidence Hashes Vaulted: ${evidenceCount}

Please draft:
1. Executive Risk Summary suitable for C-level leadership.
2. Immediate 30-day tactical remediation priorities.
3. Strategic defensive architectural recommendations.`
                );
              }}
            >
              <Sparkles size={14} color="#38bdf8" /> AI Executive Briefing
            </button>
          )}
        </div>
      </div>

      {/* KPI Metrics Grid */}
      <div className={styles.kpiGrid}>
        <div className={`${styles.kpiCard} ${criticalCount > 0 ? styles.kpiCardHighlight : ''}`}>
          <span className={styles.kpiNumber} style={{ color: criticalCount > 0 ? '#ef4444' : '#fff' }}>
            {findings.length}
          </span>
          <span className={styles.kpiLabel}>Total Vulnerabilities Recorded</span>
          <span className={styles.kpiSubtext}>
            {criticalCount} Critical • {highCount} High
          </span>
        </div>

        <div className={styles.kpiCard}>
          <span className={styles.kpiNumber} style={{ color: Number(meanCvss) >= 7.0 ? '#f97316' : '#fff' }}>
            {meanCvss}
          </span>
          <span className={styles.kpiLabel}>Mean CVSS v3.1 Severity</span>
          <span className={styles.kpiSubtext}>
            Calculated across {scoredFindings.length} scored findings
          </span>
        </div>

        <div className={styles.kpiCard}>
          <span className={styles.kpiNumber}>{assets.length}</span>
          <span className={styles.kpiLabel}>Attack Surface Assets</span>
          <span className={styles.kpiSubtext}>
            {inScopeCount} In-Scope Targets Configured
          </span>
        </div>

        <div className={styles.kpiCard}>
          <span className={styles.kpiNumber} style={{ color: '#10b981' }}>{evidenceCount}</span>
          <span className={styles.kpiLabel}>Cryptographic Evidence Records</span>
          <span className={styles.kpiSubtext}>SHA-256 hashed audit traces</span>
        </div>
      </div>

      {/* Dashboard Sections Grid */}
      <div className={styles.dashboardGrid}>
        {/* Severity Distribution */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h3 className={styles.cardTitle}>
              <ShieldAlert size={16} color="#f97316" /> Findings by Severity
            </h3>
            <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{findings.length} Total</span>
          </div>

          <div className={styles.severityBarRow}>
            <div className={styles.barItem}>
              <div className={styles.barMeta}>
                <span style={{ color: '#ef4444', fontWeight: 600 }}>Critical</span>
                <span>{criticalCount} ({findings.length ? Math.round((criticalCount / findings.length) * 100) : 0}%)</span>
              </div>
              <div className={styles.barTrack}>
                <div
                  className={`${styles.barFill} ${styles.barCritical}`}
                  style={{ width: `${findings.length ? (criticalCount / findings.length) * 100 : 0}%` }}
                />
              </div>
            </div>

            <div className={styles.barItem}>
              <div className={styles.barMeta}>
                <span style={{ color: '#f97316', fontWeight: 600 }}>High</span>
                <span>{highCount} ({findings.length ? Math.round((highCount / findings.length) * 100) : 0}%)</span>
              </div>
              <div className={styles.barTrack}>
                <div
                  className={`${styles.barFill} ${styles.barHigh}`}
                  style={{ width: `${findings.length ? (highCount / findings.length) * 100 : 0}%` }}
                />
              </div>
            </div>

            <div className={styles.barItem}>
              <div className={styles.barMeta}>
                <span style={{ color: '#eab308', fontWeight: 600 }}>Medium</span>
                <span>{mediumCount} ({findings.length ? Math.round((mediumCount / findings.length) * 100) : 0}%)</span>
              </div>
              <div className={styles.barTrack}>
                <div
                  className={`${styles.barFill} ${styles.barMedium}`}
                  style={{ width: `${findings.length ? (mediumCount / findings.length) * 100 : 0}%` }}
                />
              </div>
            </div>

            <div className={styles.barItem}>
              <div className={styles.barMeta}>
                <span style={{ color: '#3b82f6', fontWeight: 600 }}>Low</span>
                <span>{lowCount} ({findings.length ? Math.round((lowCount / findings.length) * 100) : 0}%)</span>
              </div>
              <div className={styles.barTrack}>
                <div
                  className={`${styles.barFill} ${styles.barLow}`}
                  style={{ width: `${findings.length ? (lowCount / findings.length) * 100 : 0}%` }}
                />
              </div>
            </div>

            <div className={styles.barItem}>
              <div className={styles.barMeta}>
                <span style={{ color: '#94a3b8', fontWeight: 600 }}>Informational</span>
                <span>{infoCount} ({findings.length ? Math.round((infoCount / findings.length) * 100) : 0}%)</span>
              </div>
              <div className={styles.barTrack}>
                <div
                  className={`${styles.barFill} ${styles.barInfo}`}
                  style={{ width: `${findings.length ? (infoCount / findings.length) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Remediation Lifecycle */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h3 className={styles.cardTitle}>
              <CheckCircle size={16} color="#10b981" /> Remediation Lifecycle
            </h3>
            <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
              {fixedCount + retestedCount}/{findings.length} Resolved
            </span>
          </div>

          <div className={styles.statusGrid}>
            <div className={styles.statusBox}>
              <span className={styles.statusNum} style={{ color: '#ef4444' }}>{openCount}</span>
              <span className={styles.statusName}>Open</span>
            </div>
            <div className={styles.statusBox}>
              <span className={styles.statusNum} style={{ color: '#eab308' }}>{triagedCount}</span>
              <span className={styles.statusName}>Triaged</span>
            </div>
            <div className={styles.statusBox}>
              <span className={styles.statusNum} style={{ color: '#38bdf8' }}>{fixedCount}</span>
              <span className={styles.statusName}>Fixed</span>
            </div>
            <div className={styles.statusBox}>
              <span className={styles.statusNum} style={{ color: '#10b981' }}>{retestedCount}</span>
              <span className={styles.statusName}>Retested</span>
            </div>
          </div>

          <div style={{ fontSize: '0.78rem', color: '#94a3b8', lineHeight: 1.5 }}>
            {findings.length === 0 ? (
              <span>No findings loaded yet. Ingest scan data or run an API contract audit to start.</span>
            ) : openCount === 0 ? (
              <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <CheckCircle size={14} /> All logged vulnerabilities have been triaged or remediated!
              </span>
            ) : (
              <span>
                {openCount} vulnerabilities currently require developer remediation or re-test verification.
              </span>
            )}
          </div>
        </div>

        {/* Top Technologies Detected */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h3 className={styles.cardTitle}>
              <Layers size={16} color="#38bdf8" /> Technology Exposure
            </h3>
            <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{Object.keys(techMap).length} Detected</span>
          </div>

          {topTechnologies.length === 0 ? (
            <div style={{ fontSize: '0.78rem', color: '#64748b', textAlign: 'center', padding: '1rem' }}>
              No technology fingerprints recorded. Ingest Httpx or Katana output in Recon Hub.
            </div>
          ) : (
            <div className={styles.techList}>
              {topTechnologies.map(([tech, count], i) => (
                <div key={i} className={styles.techPill}>
                  <span>{tech}</span>
                  <span className={styles.techCount}>{count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Workbench Quick Navigation */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h3 className={styles.cardTitle}>
              <Terminal size={16} color="#a855f7" /> Assessment Modules
            </h3>
            <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Quick Access</span>
          </div>

          <div className={styles.navGrid}>
            <div
              className={styles.navCard}
              onClick={() => onTabChange && onTabChange('recon')}
            >
              <span className={styles.navTitle}>Recon Hub <ChevronRight size={13} /></span>
              <span className={styles.navDesc}>Artifact ingestion & asset matrix</span>
            </div>

            <div
              className={styles.navCard}
              onClick={() => onTabChange && onTabChange('api_studio')}
            >
              <span className={styles.navTitle}>API Studio <ChevronRight size={13} /></span>
              <span className={styles.navDesc}>OpenAPI 3 / Swagger gap matrix</span>
            </div>

            <div
              className={styles.navCard}
              onClick={() => onTabChange && onTabChange('remediation')}
            >
              <span className={styles.navTitle}>Remediation <ChevronRight size={13} /></span>
              <span className={styles.navDesc}>Side-by-side patch diff viewer</span>
            </div>

            <div
              className={styles.navCard}
              onClick={() => onTabChange && onTabChange('reports')}
            >
              <span className={styles.navTitle}>Report Studio <ChevronRight size={13} /></span>
              <span className={styles.navDesc}>CVSS scoring & markdown export</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
