import { Check, Copy, ExternalLink, FileCode, Search, Shield, Terminal } from 'lucide-react';
import type {
  CloudBucketCandidate,
  ReconDork,
  ReconPipelineStep,
} from '../../lib/security/reconPresets';
import styles from './ReconHub.module.css';

interface ReconOsintTabProps {
  activeTab: 'pipelines' | 'google_dorks' | 'github_secrets' | 'cloud_s3';
  pipelines: ReconPipelineStep[];
  googleDorks: ReconDork[];
  githubDorks: ReconDork[];
  cloudBuckets: CloudBucketCandidate[];
  copiedId: string | null;
  onCopy: (id: string, text: string) => void;
}

export default function ReconOsintTab({
  activeTab,
  pipelines,
  googleDorks,
  githubDorks,
  cloudBuckets,
  copiedId,
  onCopy,
}: ReconOsintTabProps) {
  return (
    <div className={styles.grid}>
      {activeTab === 'pipelines' &&
        pipelines.map((p) => (
          <div key={p.id} className={styles.reconCard}>
            <div className={styles.cardHeader}>
              <span className={styles.cardTitle}>
                <Terminal size={14} color="#38bdf8" /> {p.name}
              </span>
              <button className={styles.btn} onClick={() => onCopy(p.id, p.command)}>
                {copiedId === p.id ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                {copiedId === p.id ? 'Copied' : 'Copy'}
              </button>
            </div>
            <div className={styles.codeBox}>{p.command}</div>
          </div>
        ))}

      {activeTab === 'google_dorks' &&
        googleDorks.map((d) => (
          <div key={d.id} className={styles.reconCard}>
            <div className={styles.cardHeader}>
              <span className={styles.cardTitle}>
                <Search size={14} color="#fbbf24" /> {d.name}
              </span>
              <div style={{ display: 'flex', gap: '0.3rem' }}>
                <button className={styles.btn} onClick={() => onCopy(d.id, d.query)}>
                  {copiedId === d.id ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                  {copiedId === d.id ? 'Copied' : 'Copy'}
                </button>
                <a
                  href={`https://www.google.com/search?q=${encodeURIComponent(d.query)}`}
                  target="_blank"
                  rel="noreferrer"
                  className={`${styles.btn} ${styles.btnPrimary}`}
                >
                  <ExternalLink size={12} /> Search
                </a>
              </div>
            </div>
            <div className={styles.dorkQuery}>{d.query}</div>
          </div>
        ))}

      {activeTab === 'github_secrets' &&
        githubDorks.map((g) => (
          <div key={g.id} className={styles.reconCard}>
            <div className={styles.cardHeader}>
              <span className={styles.cardTitle}>
                <FileCode size={14} color="#a78bfa" /> {g.name}
              </span>
              <div style={{ display: 'flex', gap: '0.3rem' }}>
                <button className={styles.btn} onClick={() => onCopy(g.id, g.query)}>
                  {copiedId === g.id ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                  {copiedId === g.id ? 'Copied' : 'Copy'}
                </button>
                <a
                  href={`https://github.com/search?type=code&q=${encodeURIComponent(g.query)}`}
                  target="_blank"
                  rel="noreferrer"
                  className={`${styles.btn} ${styles.btnPrimary}`}
                >
                  <ExternalLink size={12} /> GitHub
                </a>
              </div>
            </div>
            <div className={styles.dorkQuery}>{g.query}</div>
          </div>
        ))}

      {activeTab === 'cloud_s3' &&
        cloudBuckets.map((b) => (
          <div key={b.id} className={styles.reconCard}>
            <div className={styles.cardHeader}>
              <span className={styles.cardTitle}>
                <Shield size={14} color="#34d399" /> {b.name}
              </span>
              <div style={{ display: 'flex', gap: '0.3rem' }}>
                <button className={styles.btn} onClick={() => onCopy(b.id, b.url)}>
                  {copiedId === b.id ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                  {copiedId === b.id ? 'Copied' : 'Copy'}
                </button>
                <a
                  href={b.url}
                  target="_blank"
                  rel="noreferrer"
                  className={`${styles.btn} ${styles.btnPrimary}`}
                >
                  <ExternalLink size={12} /> Test Bucket
                </a>
              </div>
            </div>
            <div className={styles.dorkQuery}>{b.url}</div>
          </div>
        ))}
    </div>
  );
}
