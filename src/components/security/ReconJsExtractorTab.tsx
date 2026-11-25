import {
  Check,
  Copy,
  FileCode,
  FileSearch,
  Globe,
  Key,
  Play,
  Plus,
  Shield,
  ShieldAlert,
  Sparkles,
  Target,
} from 'lucide-react';
import { workbenchBridge } from '../../lib/security/workbenchBridge';
import {
  SAMPLE_JS_BUNDLE,
  type ExtractedEndpoint,
  type ExtractedSecret,
} from '../../lib/security/jsExtractor';
import type { ScopeItem } from '../../types';
import styles from './ReconHub.module.css';

interface ReconJsResult {
  secrets: ExtractedSecret[];
  endpoints: ExtractedEndpoint[];
  domains: string[];
}

interface ReconJsExtractorTabProps {
  cleanDomain: string;
  jsInput: string;
  setJsInput: (value: string) => void;
  jsFilter: 'all' | 'secrets' | 'endpoints';
  setJsFilter: (filter: 'all' | 'secrets' | 'endpoints') => void;
  jsResult: ReconJsResult;
  copiedId: string | null;
  onCopy: (id: string, text: string) => void;
  onAddEndpointsToSurface: () => void;
  onCreateSecretFinding: (secret: ExtractedSecret) => void;
  onAISecretPoC: (secret: ExtractedSecret) => void;
}

export default function ReconJsExtractorTab({
  cleanDomain,
  jsInput,
  setJsInput,
  jsFilter,
  setJsFilter,
  jsResult,
  copiedId,
  onCopy,
  onAddEndpointsToSurface,
  onCreateSecretFinding,
  onAISecretPoC,
}: ReconJsExtractorTabProps) {
  return (
    <div className={styles.jsContainer}>
      {/* Key Metric Tiles for JS Extraction */}
      <div className={styles.metricsStrip}>
        <div className={styles.metricCard}>
          <div className={styles.metricInfo}>
            <span className={styles.metricLabel}>Exposed Secrets</span>
            <span
              className={styles.metricValue}
              style={{ color: jsResult.secrets.length > 0 ? '#ef4444' : '#10b981' }}
            >
              {jsResult.secrets.length}
            </span>
          </div>
          <Key size={18} color={jsResult.secrets.length > 0 ? '#ef4444' : '#10b981'} />
        </div>

        <div className={styles.metricCard}>
          <div className={styles.metricInfo}>
            <span className={styles.metricLabel}>Discovered Endpoints</span>
            <span className={styles.metricValue} style={{ color: '#38bdf8' }}>
              {jsResult.endpoints.length}
            </span>
          </div>
          <FileSearch size={18} color="#38bdf8" />
        </div>

        <div className={styles.metricCard}>
          <div className={styles.metricInfo}>
            <span className={styles.metricLabel}>Discovered Domains</span>
            <span className={styles.metricValue} style={{ color: '#f59e0b' }}>
              {jsResult.domains.length}
            </span>
          </div>
          <Globe size={18} color="#f59e0b" />
        </div>
      </div>

      {/* JS Bundle Input Textarea */}
      <div className={styles.jsEditorBox}>
        <div className={styles.jsHeaderRow}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <FileCode size={14} color="#38bdf8" />
            <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>
              JavaScript Source / Webpack Bundle
            </span>
            <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
              ({jsInput.length.toLocaleString()} characters)
            </span>
          </div>
          <div style={{ display: 'flex', gap: '0.35rem' }}>
            <button
              className={styles.btn}
              style={{ padding: '0.2rem 0.5rem', fontSize: '0.72rem' }}
              onClick={() => setJsInput('')}
            >
              Clear
            </button>
          </div>
        </div>

        <textarea
          className={styles.jsTextarea}
          value={jsInput}
          onChange={(e) => setJsInput(e.target.value)}
          placeholder="Paste JavaScript bundle, chunk file, or API config code here..."
        />
      </div>

      {/* Filter Sub-Pills */}
      <div className={styles.explorerControls}>
        <div className={styles.filterGroup}>
          <button
            className={`${styles.btn} ${jsFilter === 'all' ? styles.btnPrimary : ''}`}
            onClick={() => setJsFilter('all')}
          >
            All Findings ({jsResult.secrets.length + jsResult.endpoints.length})
          </button>
          <button
            className={`${styles.btn} ${jsFilter === 'secrets' ? styles.btnPrimary : ''}`}
            onClick={() => setJsFilter('secrets')}
            style={{ color: jsResult.secrets.length > 0 ? '#ef4444' : undefined }}
          >
            <Key size={11} /> Leaked Secrets ({jsResult.secrets.length})
          </button>
          <button
            className={`${styles.btn} ${jsFilter === 'endpoints' ? styles.btnPrimary : ''}`}
            onClick={() => setJsFilter('endpoints')}
          >
            <FileSearch size={11} /> Endpoints ({jsResult.endpoints.length})
          </button>
        </div>

        {jsResult.endpoints.length > 0 && (
          <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={onAddEndpointsToSurface}>
            <Plus size={12} /> Add ({jsResult.endpoints.length}) Endpoints to Attack Surface
          </button>
        )}
      </div>

      {/* Secrets Section */}
      {(jsFilter === 'all' || jsFilter === 'secrets') && jsResult.secrets.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <ShieldAlert size={14} color="#ef4444" />
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#ef4444' }}>
              Hardcoded Credentials & Leaked Tokens ({jsResult.secrets.length})
            </span>
          </div>

          <div className={styles.secretsList}>
            {jsResult.secrets.map((sec) => (
              <div
                key={sec.id}
                className={`${styles.secretCard} ${
                  sec.severity === 'critical'
                    ? styles.secretCardCritical
                    : sec.severity === 'high'
                      ? styles.secretCardHigh
                      : styles.secretCardMedium
                }`}
              >
                <div className={styles.secretCardTop}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                    <span
                      className={`${styles.riskBadge} ${
                        sec.severity === 'critical'
                          ? styles.riskCritical
                          : sec.severity === 'high'
                            ? styles.riskHigh
                            : styles.riskMedium
                      }`}
                    >
                      {sec.severity}
                    </span>
                    <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#f8fafc' }}>
                      {sec.name}
                    </span>
                    <span className={styles.cweTag}>{sec.cwe}</span>
                    <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Line {sec.line}</span>
                  </div>

                  <div style={{ display: 'flex', gap: '0.35rem' }}>
                    <button
                      className={`${styles.btn} ${styles.btnPrimary}`}
                      onClick={() => onCreateSecretFinding(sec)}
                      title="Generate a formal vulnerability report finding in Reports Studio"
                    >
                      <Shield size={11} /> Create Finding in Report
                    </button>
                    <button
                      className={styles.btn}
                      style={{ color: '#10b981', borderColor: 'rgba(16,185,129,0.3)' }}
                      onClick={() => onAISecretPoC(sec)}
                      title="Ask AI for verification steps and bug bounty report writeup"
                    >
                      <Sparkles size={11} /> AI PoC
                    </button>
                  </div>
                </div>

                <div className={styles.secretValueBox}>
                  <span style={{ wordBreak: 'break-all' }}>{sec.value}</span>
                  <button
                    className={styles.btn}
                    style={{ padding: '0.15rem 0.4rem', fontSize: '0.68rem', flexShrink: 0 }}
                    onClick={() => onCopy(sec.id, sec.value)}
                  >
                    {copiedId === sec.id ? <Check size={11} color="#10b981" /> : <Copy size={11} />}
                  </button>
                </div>

                <div style={{ fontSize: '0.74rem', color: '#94a3b8' }}>{sec.description}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Endpoints Section */}
      {(jsFilter === 'all' || jsFilter === 'endpoints') && jsResult.endpoints.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <FileSearch size={14} color="#38bdf8" />
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#38bdf8' }}>
              Extracted Routes & API Endpoints ({jsResult.endpoints.length})
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            {jsResult.endpoints.map((ep) => {
              const methodClass =
                ep.method === 'POST'
                  ? styles.methodBadgePost
                  : ep.method === 'PUT'
                    ? styles.methodBadgePut
                    : ep.method === 'DELETE'
                      ? styles.methodBadgeDelete
                      : styles.methodBadge;

              return (
                <div key={ep.id} className={styles.endpointItem}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      flex: '1 1 300px',
                      minWidth: 0,
                    }}
                  >
                    <span className={`${styles.methodBadge} ${methodClass}`}>{ep.method}</span>
                    <span
                      style={{
                        fontFamily: 'JetBrains Mono, monospace',
                        fontSize: '0.78rem',
                        color: 'var(--text-primary)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={ep.url}
                    >
                      {ep.path}
                    </span>
                    {ep.flags.map((f, i) => (
                      <span
                        key={i}
                        className={styles.flagBadge}
                        style={{ fontSize: '0.62rem', padding: '0.05rem 0.35rem' }}
                      >
                        {f}
                      </span>
                    ))}
                  </div>

                  <div style={{ display: 'flex', gap: '0.35rem', flexShrink: 0 }}>
                    <button
                      className={styles.btn}
                      style={{ padding: '0.2rem 0.5rem', fontSize: '0.72rem' }}
                      onClick={() => {
                        const rawReq = `${ep.method} ${ep.path} HTTP/1.1\nHost: ${cleanDomain}\nUser-Agent: Mozilla/5.0 NexusBounty/2.0\nAccept: application/json\n\n`;
                        workbenchBridge.loadHttp(rawReq);
                      }}
                      title="Replay endpoint in HTTP Studio"
                    >
                      <Play size={10} /> Replay
                    </button>
                    <button
                      className={styles.btn}
                      style={{ padding: '0.2rem 0.5rem', fontSize: '0.72rem' }}
                      onClick={() => {
                        const scopeItem: ScopeItem = {
                          id: `scope-js-${Date.now()}`,
                          target: ep.url,
                          type: 'api',
                          inScope: true,
                          techStack: ['API'],
                          notes: `Extracted from JS Bundle: ${ep.path} (${ep.flags.join(', ') || 'Route'})`,
                          status: 'untested',
                        };
                        workbenchBridge.addScopeItems([scopeItem]);
                      }}
                      title="Add endpoint to Scope Manager"
                    >
                      <Target size={10} color="#38bdf8" /> Scope
                    </button>
                    <button
                      className={styles.btn}
                      style={{ padding: '0.2rem 0.4rem', fontSize: '0.72rem' }}
                      onClick={() => onCopy(ep.id, ep.url)}
                      title="Copy full URL"
                    >
                      {copiedId === ep.id ? <Check size={10} color="#10b981" /> : <Copy size={10} />}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty state when no results */}
      {jsResult.secrets.length === 0 && jsResult.endpoints.length === 0 && (
        <div className={styles.emptyState}>
          <FileSearch size={32} color="#64748b" />
          <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>
            No secrets or endpoints found in JS source
          </span>
          <span style={{ fontSize: '0.78rem' }}>
            Paste code from an application bundle, upload a .js file, or reset to the sample Webpack bundle.
          </span>
          <button
            className={`${styles.btn} ${styles.btnPrimary}`}
            onClick={() => setJsInput(SAMPLE_JS_BUNDLE)}
          >
            Load Sample Bundle
          </button>
        </div>
      )}
    </div>
  );
}
