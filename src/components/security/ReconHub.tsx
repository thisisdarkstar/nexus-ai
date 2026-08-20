import { useState, useMemo, useEffect } from 'react';
import {
  Search,
  Globe,
  Copy,
  Check,
  Sparkles,
  ExternalLink,
  Terminal,
  FileCode,
  Shield,
} from 'lucide-react';
import styles from './ReconHub.module.css';

interface ReconHubProps {
  onSendToAI: (prompt: string) => void;
}

type ReconTab = 'pipelines' | 'google_dorks' | 'github_secrets' | 'cloud_s3';

const RECON_TARGET_STORAGE_KEY = 'nexus_security_recon_target';

export default function ReconHub({ onSendToAI }: ReconHubProps) {
  const [targetDomain, setTargetDomain] = useState(() => {
    return localStorage.getItem(RECON_TARGET_STORAGE_KEY) || 'example.com';
  });

  useEffect(() => {
    try {
      localStorage.setItem(RECON_TARGET_STORAGE_KEY, targetDomain);
    } catch (e) {
      console.error(e);
    }
  }, [targetDomain]);
  const [activeTab, setActiveTab] = useState<ReconTab>('pipelines');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const cleanDomain = useMemo(() => {
    return targetDomain
      .replace(/^https?:\/\//i, '')
      .replace(/\/.*$/, '')
      .replace(/^\*\./, '')
      .trim() || 'example.com';
  }, [targetDomain]);

  const pipelines = useMemo(() => {
    return [
      {
        id: 'subdomain_passive',
        name: '1. Fast Passive Subdomain Enumeration',
        tool: 'Subfinder + Assetfinder',
        command: `subfinder -d ${cleanDomain} -all -silent | assetfinder --subs-only | sort -u > subdomains_${cleanDomain}.txt`,
      },
      {
        id: 'host_probe',
        name: '2. Live HTTP Probing & Tech Stack Fingerprinting',
        tool: 'Httpx',
        command: `cat subdomains_${cleanDomain}.txt | httpx -title -tech-detect -status-code -follow-redirects -silent -o live_${cleanDomain}.txt`,
      },
      {
        id: 'crawl_endpoints',
        name: '3. Web Endpoint & Archive URL Extraction',
        tool: 'Katana + GAU',
        command: `katana -u live_${cleanDomain}.txt -jc -d 3 -silent | gau --subs | sort -u > endpoints_${cleanDomain}.txt`,
      },
      {
        id: 'nuclei_scan',
        name: '4. Targeted Nuclei Vulnerability Scan',
        tool: 'Nuclei v3',
        command: `nuclei -l live_${cleanDomain}.txt -t cves/,vulnerabilities/,exposures/ -severity critical,high,medium -stats -o nuclei_${cleanDomain}.txt`,
      },
      {
        id: 'dir_fuzzing',
        name: '5. Fast Directory & File Discovery',
        tool: 'FFUF',
        command: `ffuf -w /usr/share/wordlists/dirb/common.txt -u https://${cleanDomain}/FUZZ -mc 200,301,302,403 -c -v`,
      },
      {
        id: 'js_secrets',
        name: '6. JavaScript Sensitive Data & Token Extraction',
        tool: 'Grep + Nuclei',
        command: `cat endpoints_${cleanDomain}.txt | grep -E '\\.js(\\?.*)?$' | nuclei -t exposures/tokens/ -silent`,
      },
    ];
  }, [cleanDomain]);

  const googleDorks = useMemo(() => {
    return [
      {
        id: 'dork_env',
        name: 'Exposed .env & Configuration Files',
        query: `site:${cleanDomain} (ext:env OR ext:yml OR ext:yaml OR ext:config OR ext:json) "DB_PASSWORD" OR "API_KEY" OR "SECRET"`,
      },
      {
        id: 'dork_index',
        name: 'Open Directory Indexes',
        query: `site:${cleanDomain} intitle:"Index of /" OR intitle:"Index of /uploads" OR intitle:"parent directory"`,
      },
      {
        id: 'dork_admin',
        name: 'Admin Portals & Login Interfaces',
        query: `site:${cleanDomain} inurl:admin OR inurl:login OR inurl:dashboard OR inurl:cpanel OR inurl:portal`,
      },
      {
        id: 'dork_api',
        name: 'Swagger UI & OpenAPI Specifications',
        query: `site:${cleanDomain} inurl:swagger OR inurl:api-docs OR inurl:"/v1/api-docs" OR inurl:graphql`,
      },
      {
        id: 'dork_sql',
        name: 'Database Dumps & Backup Archives',
        query: `site:${cleanDomain} (ext:sql OR ext:db OR ext:bak OR ext:tar OR ext:zip OR ext:7z) intext:"dump" OR intext:"password"`,
      },
      {
        id: 'dork_phpinfo',
        name: 'Server Diagnostics & PHPInfo',
        query: `site:${cleanDomain} ext:php "PHP Version" OR "Configuration File (php.ini) Path"`,
      },
    ];
  }, [cleanDomain]);

  const githubDorks = useMemo(() => {
    return [
      {
        id: 'gh_pw',
        name: 'Target Passwords & API Keys in Public Repos',
        query: `"${cleanDomain}" password OR secret OR api_key OR token`,
      },
      {
        id: 'gh_aws',
        name: 'AWS Credentials Linked to Domain',
        query: `"${cleanDomain}" AKIA[0-9A-Z]{16} OR aws_secret_access_key`,
      },
      {
        id: 'gh_subdomains',
        name: 'Internal Hostnames & Dev Endpoints',
        query: `"${cleanDomain}" "staging" OR "dev" OR "internal" OR "vpn"`,
      },
      {
        id: 'gh_s3',
        name: 'S3 Buckets & Cloud Storage Mentions',
        query: `"${cleanDomain}" s3.amazonaws.com OR blob.core.windows.net`,
      },
    ];
  }, [cleanDomain]);

  const cloudBuckets = useMemo(() => {
    return [
      {
        id: 's3_std',
        name: 'AWS S3 Standard URL',
        url: `https://${cleanDomain.replace(/\./g, '-')}.s3.amazonaws.com`,
      },
      {
        id: 's3_dot',
        name: 'AWS S3 Dot-Domain URL',
        url: `https://s3.amazonaws.com/${cleanDomain}`,
      },
      {
        id: 'gcs_std',
        name: 'Google Cloud Storage URL',
        url: `https://storage.googleapis.com/${cleanDomain}`,
      },
      {
        id: 'azure_blob',
        name: 'Azure Blob Storage URL',
        url: `https://${cleanDomain.replace(/\./g, '')}.blob.core.windows.net/`,
      },
    ];
  }, [cleanDomain]);

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleAIRecon = () => {
    const prompt = `I am conducting an authorized penetration test on target: **${cleanDomain}**.
Generate an end-to-end OSINT and Reconnaissance Attack Plan tailored specifically for this domain:

1. **Subdomain Takeover & CNAME Patterns**: Common cloud services and DNS checks.
2. **High-Yield Search Queries & Dorks**: Specific dorks for GitHub, Shodan, Censys, and SecurityTrails.
3. **API & Hidden Endpoint Strategy**: Framework-specific paths to probe.
4. **Cloud Asset Discovery**: Cloud storage bucket enumeration commands.`;
    onSendToAI(prompt);
  };

  return (
    <div className={styles.reconContainer}>
      {/* Target Domain Input Bar */}
      <div className={styles.targetCard}>
        <Globe size={16} color="var(--accent-color)" />
        <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Active Target Domain:</span>
        <input
          className={styles.targetInput}
          value={targetDomain}
          onChange={(e) => setTargetDomain(e.target.value)}
          placeholder="example.com"
        />
        <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleAIRecon}>
          <Sparkles size={13} /> AI Recon Plan
        </button>
      </div>

      {/* Sub Tabs Bar */}
      <div className={styles.topBar}>
        <div className={styles.tabGroup}>
          <button
            className={`${styles.subTab} ${activeTab === 'pipelines' ? styles.active : ''}`}
            onClick={() => setActiveTab('pipelines')}
          >
            <Terminal size={12} /> CLI Tool Chains
          </button>
          <button
            className={`${styles.subTab} ${activeTab === 'google_dorks' ? styles.active : ''}`}
            onClick={() => setActiveTab('google_dorks')}
          >
            <Search size={12} /> Google Dorks
          </button>
          <button
            className={`${styles.subTab} ${activeTab === 'github_secrets' ? styles.active : ''}`}
            onClick={() => setActiveTab('github_secrets')}
          >
            <FileCode size={12} /> GitHub Secrets
          </button>
          <button
            className={`${styles.subTab} ${activeTab === 'cloud_s3' ? styles.active : ''}`}
            onClick={() => setActiveTab('cloud_s3')}
          >
            <Shield size={12} /> Cloud Buckets
          </button>
        </div>
      </div>

      {/* Grid Content */}
      <div className={styles.grid}>
        {activeTab === 'pipelines' &&
          pipelines.map((p) => (
            <div key={p.id} className={styles.reconCard}>
              <div className={styles.cardHeader}>
                <span className={styles.cardTitle}>
                  <Terminal size={14} color="#38bdf8" /> {p.name}
                </span>
                <button className={styles.btn} onClick={() => handleCopy(p.id, p.command)}>
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
                  <button className={styles.btn} onClick={() => handleCopy(d.id, d.query)}>
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
                  <button className={styles.btn} onClick={() => handleCopy(g.id, g.query)}>
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
                  <button className={styles.btn} onClick={() => handleCopy(b.id, b.url)}>
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
    </div>
  );
}
