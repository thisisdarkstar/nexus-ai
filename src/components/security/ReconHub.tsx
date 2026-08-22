import { useState, useMemo, useEffect } from 'react';
import {
  Search,
  Copy,
  Check,
  ExternalLink,
  Sparkles,
  Terminal,
} from 'lucide-react';

import {
  getReconPipelines,
  getGoogleDorks,
  getGithubDorks,
  getShodanDorks,
  getCloudBuckets,
} from '../../data/security/reconDefinitions';
import ReconTargetBar from './recon/ReconTargetBar';
import ReconTabNav, { type ReconTab } from './recon/ReconTabNav';
import styles from './ReconHub.module.css';

interface ReconHubProps {
  onSendToAI: (prompt: string) => void;
}

const RECON_TARGET_STORAGE_KEY = 'nexus_security_recon_target';
const RECON_TAB_STORAGE_KEY = 'nexus_security_recon_tab';

export default function ReconHub({ onSendToAI }: ReconHubProps) {
  const [targetDomain, setTargetDomain] = useState(() => {
    try { return localStorage.getItem(RECON_TARGET_STORAGE_KEY) || 'example.com'; } catch { return 'example.com'; }
  });

  const [activeTab, setActiveTab] = useState<ReconTab>(() => {
    try { return (localStorage.getItem(RECON_TAB_STORAGE_KEY) as ReconTab) || 'pipelines'; } catch { return 'pipelines'; }
  });
  const [filterQuery, setFilterQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(RECON_TARGET_STORAGE_KEY, targetDomain);
      localStorage.setItem(RECON_TAB_STORAGE_KEY, activeTab);
    } catch (e) {
      console.error(e);
    }
  }, [targetDomain, activeTab]);

  const cleanDomain = useMemo(() => {
    return (
      targetDomain
        .replace(/^https?:\/\//i, '')
        .replace(/\/.*$/, '')
        .replace(/^\*\./, '')
        .trim() || 'example.com'
    );
  }, [targetDomain]);

  const orgName = useMemo(() => {
    return cleanDomain.split('.')[0] || 'example';
  }, [cleanDomain]);

  const pipelines = useMemo(() => getReconPipelines(cleanDomain, orgName), [cleanDomain, orgName]);
  const googleDorks = useMemo(() => getGoogleDorks(cleanDomain), [cleanDomain]);
  const githubDorks = useMemo(() => getGithubDorks(cleanDomain), [cleanDomain]);
  const shodanDorks = useMemo(() => getShodanDorks(cleanDomain, orgName), [cleanDomain, orgName]);
  const cloudBuckets = useMemo(() => getCloudBuckets(cleanDomain, orgName), [cleanDomain, orgName]);

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleAIRecon = () => {
    const prompt = `I am conducting an authorized penetration test on target: **${cleanDomain}**.
Generate an end-to-end OSINT and Reconnaissance Attack Plan tailored specifically for this domain:

1. **Subdomain Takeover & CNAME Patterns**: Common cloud services and DNS checks for ${cleanDomain}.
2. **High-Yield Search Queries & Dorks**: Specific dorks for GitHub, Shodan, Censys, and SecurityTrails.
3. **API & Hidden Endpoint Strategy**: Framework-specific paths to probe.
4. **Cloud Asset Discovery**: Cloud storage bucket enumeration commands.`;
    onSendToAI(prompt);
  };

  const splitTitle = (name: string) => {
    const match = name.match(/^(\d+\.\s*)(.*)/);
    if (match) return { num: match[1].trim(), title: match[2] };
    return { num: null, title: name };
  };

  return (
    <div className={styles.reconContainer}>
      {/* Top Target Configuration Bar */}
      <ReconTargetBar
        targetDomain={targetDomain}
        onChangeTargetDomain={setTargetDomain}
        cleanDomain={cleanDomain}
        onSendToAI={handleAIRecon}
      />

      {/* Tab Navigation */}
      <ReconTabNav activeTab={activeTab} onSelectTab={setActiveTab} />

      {/* Search Filter */}
      <div className={styles.filterBar}>
        <div className={styles.searchWrapper}>
          <Search size={14} className={styles.searchIcon} />
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Filter recon commands, dorks, or tools..."
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Content Grid */}
      <div className={styles.itemsGrid}>
        {activeTab === 'pipelines' &&
          pipelines
            .filter((p) => !filterQuery || p.name.toLowerCase().includes(filterQuery.toLowerCase()) || p.tool.toLowerCase().includes(filterQuery.toLowerCase()))
            .map((p) => (
              <div key={p.id} className={styles.itemCard}>
                <div className={styles.itemHeader}>
                  <div className={styles.itemTitleGroup}>
                    <span className={styles.itemBadge} style={{ backgroundColor: p.badgeColor }}>
                      {p.category}
                    </span>
                    <span className={styles.itemName}>
                      {(() => { const { num, title } = splitTitle(p.name); return (<><span className={styles.itemNumber}>{num}</span><span className={styles.itemTitle}>{title}</span></>); })()}
                    </span>
                  </div>
                  <div className={styles.itemActions}>
                    <button className={styles.copyBtn} onClick={() => handleCopy(p.id, p.command)}>
                      {copiedId === p.id ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                      <span>{copiedId === p.id ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                </div>
                <div className={styles.toolLabel}><Terminal size={10} /> {p.tool}</div>
                <pre className={styles.cmdPre}>
                  <code>{p.command}</code>
                </pre>
              </div>
            ))}

        {activeTab === 'google_dorks' &&
          googleDorks
            .filter((d) => !filterQuery || d.name.toLowerCase().includes(filterQuery.toLowerCase()) || d.query.toLowerCase().includes(filterQuery.toLowerCase()))
            .map((d) => (
              <div key={d.id} className={styles.itemCard}>
                <div className={styles.itemHeader}>
                  <div className={styles.itemTitleGroup}>
                    <span className={styles.itemBadge} style={{ backgroundColor: d.badgeColor }}>
                      {d.category}
                    </span>
                    <span className={styles.itemName}>
                      {(() => { const { num, title } = splitTitle(d.name); return (<><span className={styles.itemNumber}>{num}</span><span className={styles.itemTitle}>{title}</span></>); })()}
                    </span>
                  </div>
                  <div className={styles.itemActions}>
                    <button className={styles.copyBtn} onClick={() => handleCopy(d.id, d.query)}>
                      {copiedId === d.id ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                    </button>
                    <a
                      href={`https://www.google.com/search?q=${encodeURIComponent(d.query)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.linkBtn}
                    >
                      <ExternalLink size={12} /> Search Google
                    </a>
                  </div>
                </div>
                <pre className={styles.cmdPre}>
                  <code>{d.query}</code>
                </pre>
              </div>
            ))}

        {activeTab === 'github_secrets' &&
          githubDorks
            .filter((d) => !filterQuery || d.name.toLowerCase().includes(filterQuery.toLowerCase()) || d.query.toLowerCase().includes(filterQuery.toLowerCase()))
            .map((d) => (
              <div key={d.id} className={styles.itemCard}>
                <div className={styles.itemHeader}>
                  <div className={styles.itemTitleGroup}>
                    <span className={styles.itemBadge} style={{ backgroundColor: d.badgeColor }}>
                      {d.category}
                    </span>
                    <span className={styles.itemName}>
                      {(() => { const { num, title } = splitTitle(d.name); return (<><span className={styles.itemNumber}>{num}</span><span className={styles.itemTitle}>{title}</span></>); })()}
                    </span>
                  </div>
                  <div className={styles.itemActions}>
                    <button className={styles.copyBtn} onClick={() => handleCopy(d.id, d.query)}>
                      {copiedId === d.id ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                    </button>
                    <a
                      href={`https://github.com/search?type=code&q=${encodeURIComponent(d.query)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.linkBtn}
                    >
                      <ExternalLink size={12} /> Search GitHub
                    </a>
                  </div>
                </div>
                <pre className={styles.cmdPre}>
                  <code>{d.query}</code>
                </pre>
              </div>
            ))}

        {activeTab === 'shodan_osint' &&
          shodanDorks
            .filter((d) => !filterQuery || d.name.toLowerCase().includes(filterQuery.toLowerCase()) || d.query.toLowerCase().includes(filterQuery.toLowerCase()))
            .map((d) => (
              <div key={d.id} className={styles.itemCard}>
                <div className={styles.itemHeader}>
                  <div className={styles.itemTitleGroup}>
                    <span className={styles.itemBadge} style={{ backgroundColor: d.badgeColor }}>
                      {d.category}
                    </span>
                    <span className={styles.itemName}>
                      {(() => { const { num, title } = splitTitle(d.name); return (<><span className={styles.itemNumber}>{num}</span><span className={styles.itemTitle}>{title}</span></>); })()}
                    </span>
                  </div>
                  <div className={styles.itemActions}>
                    <button className={styles.copyBtn} onClick={() => handleCopy(d.id, d.query)}>
                      {copiedId === d.id ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                    </button>
                    {d.url && (
                      <a
                        href={d.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.linkBtn}
                      >
                        <ExternalLink size={12} /> Open Engine
                      </a>
                    )}
                  </div>
                </div>
                <pre className={styles.cmdPre}>
                  <code>{d.query}</code>
                </pre>
              </div>
            ))}

        {activeTab === 'cloud_s3' &&
          cloudBuckets
            .filter((b) => !filterQuery || b.name.toLowerCase().includes(filterQuery.toLowerCase()) || b.url.toLowerCase().includes(filterQuery.toLowerCase()))
            .map((b) => (
              <div key={b.id} className={styles.itemCard}>
                <div className={styles.itemHeader}>
                  <div className={styles.itemTitleGroup}>
                    <span className={styles.itemBadge} style={{ backgroundColor: b.badgeColor }}>
                      {b.provider}
                    </span>
                    <span className={styles.itemName}>
                      {(() => { const { num, title } = splitTitle(b.name); return (<><span className={styles.itemNumber}>{num}</span><span className={styles.itemTitle}>{title}</span></>); })()}
                    </span>
                  </div>
                  <div className={styles.itemActions}>
                    <button className={styles.copyBtn} onClick={() => handleCopy(b.id, b.url)}>
                      {copiedId === b.id ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                    </button>
                    <a
                      href={b.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.linkBtn}
                    >
                      <ExternalLink size={12} /> Test Bucket
                    </a>
                  </div>
                </div>
                <pre className={styles.cmdPre}>
                  <code>{b.url}</code>
                </pre>
              </div>
            ))}
      </div>
    </div>
  );
}
