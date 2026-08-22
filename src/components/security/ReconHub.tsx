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
  Radio,
  Eye,
  Database,
  Cloud,
  Layers,
  Key,
} from 'lucide-react';
import styles from './ReconHub.module.css';

interface ReconHubProps {
  onSendToAI: (prompt: string) => void;
}

type ReconTab = 'pipelines' | 'google_dorks' | 'github_secrets' | 'shodan_osint' | 'cloud_s3';

const RECON_TARGET_STORAGE_KEY = 'nexus_security_recon_target';
const RECON_TAB_STORAGE_KEY = 'nexus_security_recon_tab';

export default function ReconHub({ onSendToAI }: ReconHubProps) {
  const [targetDomain, setTargetDomain] = useState(() => {
    return localStorage.getItem(RECON_TARGET_STORAGE_KEY) || 'example.com';
  });

  const [activeTab, setActiveTab] = useState<ReconTab>(() => {
    return (localStorage.getItem(RECON_TAB_STORAGE_KEY) as ReconTab) || 'pipelines';
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

  // 1. CLI Tool Chains
  const pipelines = useMemo(() => {
    return [
      {
        id: 'subdomain_passive',
        name: '1. Fast Passive Subdomain Enumeration',
        tool: 'Subfinder + Assetfinder',
        category: 'Subdomains',
        badgeColor: '#38bdf8',
        command: `subfinder -d ${cleanDomain} -all -silent | assetfinder --subs-only | sort -u > subdomains_${cleanDomain}.txt`,
      },
      {
        id: 'dns_bruteforce',
        name: '2. Active DNS Brute-Forcing & Resolution',
        tool: 'PureDNS + DNSx',
        category: 'DNS Resolution',
        badgeColor: '#60a5fa',
        command: `puredns bruteforce /usr/share/seclists/Discovery/DNS/subdomains-top1million-5000.txt ${cleanDomain} -r resolvers.txt | dnsx -silent -o dns_resolved_${cleanDomain}.txt`,
      },
      {
        id: 'port_scan',
        name: '3. Fast Port Scanning & Service Discovery',
        tool: 'Naabu + Nmap',
        category: 'Port Scanning',
        badgeColor: '#a78bfa',
        command: `naabu -host ${cleanDomain} -p - -rate 1000 -c 50 -nmap-cli "nmap -sV -sC" -o open_ports_${cleanDomain}.txt`,
      },
      {
        id: 'host_probe',
        name: '4. Live HTTP Probing & Tech Fingerprinting',
        tool: 'Httpx',
        category: 'HTTP Probing',
        badgeColor: '#34d399',
        command: `httpx -l subdomains_${cleanDomain}.txt -title -tech-detect -status-code -follow-redirects -silent -o live_${cleanDomain}.txt`,
      },
      {
        id: 'crawl_endpoints',
        name: '5. Deep Web Crawler & Archive URL Extraction',
        tool: 'Katana + GAU',
        category: 'Crawling',
        badgeColor: '#fbbf24',
        command: `katana -u live_${cleanDomain}.txt -jc -kf -d 3 -silent -o katana_${cleanDomain}.txt && gau ${cleanDomain} | sort -u >> endpoints_${cleanDomain}.txt`,
      },
      {
        id: 'param_mining',
        name: '6. Hidden Parameter Discovery & Mining',
        tool: 'Arjun',
        category: 'Parameters',
        badgeColor: '#f97316',
        command: `arjun -u https://${cleanDomain} -m GET,POST --passive-only -oT params_${cleanDomain}.txt`,
      },
      {
        id: 'js_secrets',
        name: '7. JavaScript Secret & Token Scraping',
        tool: 'Httpx + Nuclei',
        category: 'JS Analysis',
        badgeColor: '#ec4899',
        command: `cat endpoints_${cleanDomain}.txt | grep -E '\\.js(\\?.*)?$' | httpx -silent | nuclei -t http/exposures/tokens/ -silent -o js_secrets_${cleanDomain}.txt`,
      },
      {
        id: 'visual_recon',
        name: '8. Visual Reconnaissance & Bulk Screenshots',
        tool: 'Gowitness',
        category: 'Visual Recon',
        badgeColor: '#818cf8',
        command: `gowitness scan file -f live_${cleanDomain}.txt --screenshot-path ./screenshots_${cleanDomain} --threads 8`,
      },
      {
        id: 'dir_fuzzing',
        name: '9. High-Speed Directory & Content Fuzzing',
        tool: 'FFUF',
        category: 'Directory Fuzzing',
        badgeColor: '#f59e0b',
        command: `ffuf -w /usr/share/wordlists/dirsearch.txt -u https://${cleanDomain}/FUZZ -mc 200,301,302,401,403 -c -v -o ffuf_${cleanDomain}.json`,
      },
      {
        id: 'nuclei_scan',
        name: '10. Targeted Nuclei Vulnerability Scan',
        tool: 'Nuclei v3',
        category: 'Vulnerability Scan',
        badgeColor: '#ef4444',
        command: `nuclei -l live_${cleanDomain}.txt -t cves/,vulnerabilities/,exposures/,misconfiguration/ -severity critical,high,medium -stats -o nuclei_${cleanDomain}.txt`,
      },
      {
        id: 'subdomain_takeover',
        name: '11. Subdomain Takeover Detection',
        tool: 'Subzy',
        category: 'Takeover Checks',
        badgeColor: '#14b8a6',
        command: `subzy run --targets subdomains_${cleanDomain}.txt --concurrency 50 --hide_fails`,
      },
      {
        id: 'git_secrets',
        name: '12. Git Organization Secret Extraction',
        tool: 'TruffleHog',
        category: 'Secret Mining',
        badgeColor: '#c084fc',
        command: `trufflehog github --org=${orgName} --json > trufflehog_${cleanDomain}.json`,
      },
    ];
  }, [cleanDomain, orgName]);

  // 2. Google Dorks
  const googleDorks = useMemo(() => {
    return [
      {
        id: 'dork_env',
        name: 'Exposed .env & Configuration Files',
        category: 'Credentials',
        badgeColor: '#ef4444',
        query: `site:${cleanDomain} (ext:env OR ext:yml OR ext:yaml OR ext:config OR ext:json) "DB_PASSWORD" OR "API_KEY" OR "SECRET"`,
      },
      {
        id: 'dork_index',
        name: 'Open Directory Indexes & File Listings',
        category: 'Information Leak',
        badgeColor: '#f97316',
        query: `site:${cleanDomain} intitle:"Index of /" OR intitle:"Index of /uploads" OR intitle:"parent directory"`,
      },
      {
        id: 'dork_admin',
        name: 'Admin Portals & Single Sign-On Portals',
        category: 'Auth Portals',
        badgeColor: '#eab308',
        query: `site:${cleanDomain} inurl:admin OR inurl:login OR inurl:dashboard OR inurl:cpanel OR inurl:portal OR inurl:sso`,
      },
      {
        id: 'dork_api',
        name: 'Swagger UI, OpenAPI & GraphQL Endpoints',
        category: 'API Docs',
        badgeColor: '#3b82f6',
        query: `site:${cleanDomain} inurl:swagger OR inurl:api-docs OR inurl:"/v1/api-docs" OR inurl:graphql OR inurl:graphiql`,
      },
      {
        id: 'dork_sql',
        name: 'Database Dumps & Backup Archives',
        category: 'Database Dumps',
        badgeColor: '#dc2626',
        query: `site:${cleanDomain} (ext:sql OR ext:db OR ext:bak OR ext:tar OR ext:zip OR ext:7z OR ext:dump) intext:"dump" OR intext:"password"`,
      },
      {
        id: 'dork_logs',
        name: 'Server Error Logs & Stack Traces',
        category: 'Log Exposure',
        badgeColor: '#ec4899',
        query: `site:${cleanDomain} (ext:log OR ext:txt OR ext:out) intext:"error" OR intext:"exception" OR intext:"stack trace"`,
      },
      {
        id: 'dork_phpinfo',
        name: 'Server Diagnostics & PHPInfo Pages',
        category: 'Diagnostics',
        badgeColor: '#8b5cf6',
        query: `site:${cleanDomain} ext:php "PHP Version" OR "Configuration File (php.ini) Path"`,
      },
      {
        id: 'dork_git',
        name: 'Exposed .git Directories & Source Repos',
        category: 'VCS Exposure',
        badgeColor: '#ef4444',
        query: `site:${cleanDomain} inurl:".git" OR inurl:".gitignore" OR inurl:"/.git/config"`,
      },
      {
        id: 'dork_s3_google',
        name: 'Public Cloud Storage References',
        category: 'Cloud Storage',
        badgeColor: '#10b981',
        query: `site:s3.amazonaws.com "${cleanDomain}" OR site:storage.googleapis.com "${cleanDomain}" OR site:blob.core.windows.net "${cleanDomain}"`,
      },
    ];
  }, [cleanDomain]);

  // 3. GitHub & Secret Dorks
  const githubDorks = useMemo(() => {
    return [
      {
        id: 'gh_pw',
        name: 'Target Passwords & API Keys in Public Repos',
        category: 'Credentials',
        badgeColor: '#ef4444',
        query: `"${cleanDomain}" password OR secret OR api_key OR token`,
      },
      {
        id: 'gh_aws',
        name: 'AWS Access Keys & Secret Pairs',
        category: 'Cloud Secrets',
        badgeColor: '#f97316',
        query: `"${cleanDomain}" AKIA[0-9A-Z]{16} OR aws_secret_access_key`,
      },
      {
        id: 'gh_private_keys',
        name: 'Private RSA / OpenSSH Cryptographic Keys',
        category: 'Crypto Keys',
        badgeColor: '#dc2626',
        query: `"${cleanDomain}" "-----BEGIN RSA PRIVATE KEY-----" OR "-----BEGIN OPENSSH PRIVATE KEY-----"`,
      },
      {
        id: 'gh_db_uri',
        name: 'Database Connection URIs & Passwords',
        category: 'Database Connection',
        badgeColor: '#eab308',
        query: `"${cleanDomain}" "mongodb://" OR "postgres://" OR "mysql://" OR "redis://"`,
      },
      {
        id: 'gh_subdomains',
        name: 'Internal Hostnames & Dev/Staging Subdomains',
        category: 'Infrastructure',
        badgeColor: '#3b82f6',
        query: `"${cleanDomain}" "staging" OR "dev" OR "internal" OR "vpn" OR "corp"`,
      },
      {
        id: 'gh_jwt_oauth',
        name: 'JWT Secrets & OAuth Client Secrets',
        category: 'Auth Tokens',
        badgeColor: '#8b5cf6',
        query: `"${cleanDomain}" "JWT_SECRET" OR "client_secret" OR "oauth_token"`,
      },
      {
        id: 'gh_docker_k8s',
        name: 'Docker Compose & Kubernetes Secrets',
        category: 'DevOps Secrets',
        badgeColor: '#10b981',
        query: `"${cleanDomain}" "docker-compose" password OR "kubeconfig" OR "secretKeyRef"`,
      },
      {
        id: 'gh_s3',
        name: 'Cloud Storage Mentions & Bucket Names',
        category: 'Cloud Buckets',
        badgeColor: '#06b6d4',
        query: `"${cleanDomain}" s3.amazonaws.com OR blob.core.windows.net OR storage.googleapis.com`,
      },
    ];
  }, [cleanDomain]);

  // 4. Shodan & OSINT Queries
  const shodanDorks = useMemo(() => {
    return [
      {
        id: 'shodan_ssl_cn',
        name: 'SSL Certificate Common Name (CN)',
        category: 'Certificates',
        badgeColor: '#38bdf8',
        query: `ssl.cert.subject.CN:"${cleanDomain}"`,
        url: `https://www.shodan.io/search?query=${encodeURIComponent(`ssl.cert.subject.CN:"${cleanDomain}"`)}`,
      },
      {
        id: 'shodan_wildcard_ssl',
        name: 'Wildcard SSL Subdomain Discovery',
        category: 'Wildcard Certs',
        badgeColor: '#60a5fa',
        query: `ssl.cert.subject.CN:"*.${cleanDomain}" "200 OK"`,
        url: `https://www.shodan.io/search?query=${encodeURIComponent(`ssl.cert.subject.CN:"*.${cleanDomain}" "200 OK"`)}`,
      },
      {
        id: 'shodan_hostname',
        name: 'Hostname Association & Exposed Services',
        category: 'Hostnames',
        badgeColor: '#a78bfa',
        query: `hostname:"${cleanDomain}"`,
        url: `https://www.shodan.io/search?query=${encodeURIComponent(`hostname:"${cleanDomain}"`)}`,
      },
      {
        id: 'shodan_http_title',
        name: 'HTTP HTML Title & Brand Discovery',
        category: 'Web Titles',
        badgeColor: '#fbbf24',
        query: `http.title:"${orgName}"`,
        url: `https://www.shodan.io/search?query=${encodeURIComponent(`http.title:"${orgName}"`)}`,
      },
      {
        id: 'shodan_org_search',
        name: 'Organization Autonomous System (ASN)',
        category: 'Organization ASN',
        badgeColor: '#f97316',
        query: `org:"${orgName}"`,
        url: `https://www.shodan.io/search?query=${encodeURIComponent(`org:"${orgName}"`)}`,
      },
      {
        id: 'censys_search',
        name: 'Censys Global Service & Host Inspection',
        category: 'Censys Engine',
        badgeColor: '#34d399',
        query: `services.tls.certificates.leaf_data.subject.common_name: ${cleanDomain}`,
        url: `https://search.censys.io/search?resource=hosts&q=${encodeURIComponent(`services.tls.certificates.leaf_data.subject.common_name: ${cleanDomain}`)}`,
      },
    ];
  }, [cleanDomain, orgName]);

  // 5. Cloud Buckets
  const cloudBuckets = useMemo(() => {
    return [
      {
        id: 's3_std',
        name: 'AWS S3 Standard Hyphenated URL',
        provider: 'AWS S3',
        badgeColor: '#f97316',
        url: `https://${cleanDomain.replace(/\./g, '-')}.s3.amazonaws.com`,
      },
      {
        id: 's3_dot',
        name: 'AWS S3 Path-Style Dot URL',
        provider: 'AWS S3',
        badgeColor: '#f97316',
        url: `https://s3.amazonaws.com/${cleanDomain}`,
      },
      {
        id: 's3_org',
        name: 'AWS S3 Org Name Bucket URL',
        provider: 'AWS S3',
        badgeColor: '#f97316',
        url: `https://${orgName}.s3.amazonaws.com`,
      },
      {
        id: 'gcs_std',
        name: 'Google Cloud Storage (GCS) URL',
        provider: 'GCP Storage',
        badgeColor: '#4285f4',
        url: `https://storage.googleapis.com/${cleanDomain}`,
      },
      {
        id: 'azure_blob',
        name: 'Azure Blob Storage Container URL',
        provider: 'Azure Blob',
        badgeColor: '#0078d4',
        url: `https://${cleanDomain.replace(/[^a-z0-9]/gi, '')}.blob.core.windows.net/`,
      },
      {
        id: 'do_spaces',
        name: 'DigitalOcean Spaces Endpoint',
        provider: 'DigitalOcean',
        badgeColor: '#0080ff',
        url: `https://${cleanDomain}.nyc3.digitaloceanspaces.com`,
      },
      {
        id: 'firebase_db',
        name: 'Firebase Realtime Database JSON Endpoint',
        provider: 'Firebase',
        badgeColor: '#ffca28',
        url: `https://${orgName}.firebaseio.com/.json`,
      },
    ];
  }, [cleanDomain, orgName]);

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

  // Filter items based on filterQuery
  const filteredPipelines = useMemo(() => {
    if (!filterQuery.trim()) return pipelines;
    const q = filterQuery.toLowerCase();
    return pipelines.filter((p) => p.name.toLowerCase().includes(q) || p.tool.toLowerCase().includes(q) || p.command.toLowerCase().includes(q));
  }, [pipelines, filterQuery]);

  const filteredGoogleDorks = useMemo(() => {
    if (!filterQuery.trim()) return googleDorks;
    const q = filterQuery.toLowerCase();
    return googleDorks.filter((d) => d.name.toLowerCase().includes(q) || d.category.toLowerCase().includes(q) || d.query.toLowerCase().includes(q));
  }, [googleDorks, filterQuery]);

  const filteredGithubDorks = useMemo(() => {
    if (!filterQuery.trim()) return githubDorks;
    const q = filterQuery.toLowerCase();
    return githubDorks.filter((g) => g.name.toLowerCase().includes(q) || g.category.toLowerCase().includes(q) || g.query.toLowerCase().includes(q));
  }, [githubDorks, filterQuery]);

  const filteredShodanDorks = useMemo(() => {
    if (!filterQuery.trim()) return shodanDorks;
    const q = filterQuery.toLowerCase();
    return shodanDorks.filter((s) => s.name.toLowerCase().includes(q) || s.category.toLowerCase().includes(q) || s.query.toLowerCase().includes(q));
  }, [shodanDorks, filterQuery]);

  const filteredCloudBuckets = useMemo(() => {
    if (!filterQuery.trim()) return cloudBuckets;
    const q = filterQuery.toLowerCase();
    return cloudBuckets.filter((b) => b.name.toLowerCase().includes(q) || b.provider.toLowerCase().includes(q) || b.url.toLowerCase().includes(q));
  }, [cloudBuckets, filterQuery]);

  return (
    <div className={styles.reconContainer}>
      {/* Target Domain Input Bar */}
      <div className={styles.targetCard}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: '240px' }}>
          <Globe size={18} color="var(--accent-color)" />
          <span style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
            Target Domain:
          </span>
          <input
            className={styles.targetInput}
            value={targetDomain}
            onChange={(e) => setTargetDomain(e.target.value)}
            placeholder="example.com"
            spellCheck={false}
          />
        </div>

        <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleAIRecon}>
          <Sparkles size={14} /> AI Recon Plan
        </button>
      </div>

      {/* Sub Tabs Bar & Filter Search */}
      <div className={styles.topBar}>
        <div className={styles.tabGroup}>
          <button
            className={`${styles.subTab} ${activeTab === 'pipelines' ? styles.active : ''}`}
            onClick={() => setActiveTab('pipelines')}
          >
            <Terminal size={13} /> CLI Tool Chains ({pipelines.length})
          </button>
          <button
            className={`${styles.subTab} ${activeTab === 'google_dorks' ? styles.active : ''}`}
            onClick={() => setActiveTab('google_dorks')}
          >
            <Search size={13} /> Google Dorks ({googleDorks.length})
          </button>
          <button
            className={`${styles.subTab} ${activeTab === 'github_secrets' ? styles.active : ''}`}
            onClick={() => setActiveTab('github_secrets')}
          >
            <FileCode size={13} /> GitHub Secrets ({githubDorks.length})
          </button>
          <button
            className={`${styles.subTab} ${activeTab === 'shodan_osint' ? styles.active : ''}`}
            onClick={() => setActiveTab('shodan_osint')}
          >
            <Radio size={13} /> Shodan &amp; OSINT ({shodanDorks.length})
          </button>
          <button
            className={`${styles.subTab} ${activeTab === 'cloud_s3' ? styles.active : ''}`}
            onClick={() => setActiveTab('cloud_s3')}
          >
            <Cloud size={13} /> Cloud Assets ({cloudBuckets.length})
          </button>
        </div>

        <div style={{ position: 'relative', minWidth: '180px' }}>
          <input
            className={styles.filterInput}
            placeholder="Filter dorks & tools..."
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Grid Content */}
      <div className={styles.grid}>
        {activeTab === 'pipelines' &&
          filteredPipelines.map((p) => (
            <div key={p.id} className={styles.reconCard}>
              <div className={styles.cardHeader}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                  <span className={styles.cardTitle}>
                    <Terminal size={15} color="#38bdf8" /> {p.name}
                  </span>
                  <span className={styles.tagBadge} style={{ background: `${p.badgeColor}1a`, color: p.badgeColor, borderColor: `${p.badgeColor}40` }}>
                    {p.tool}
                  </span>
                </div>
                <button className={styles.btn} onClick={() => handleCopy(p.id, p.command)}>
                  {copiedId === p.id ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                  {copiedId === p.id ? 'Copied' : 'Copy'}
                </button>
              </div>
              <div className={styles.codeBox}>{p.command}</div>
            </div>
          ))}

        {activeTab === 'google_dorks' &&
          filteredGoogleDorks.map((d) => (
            <div key={d.id} className={styles.reconCard}>
              <div className={styles.cardHeader}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                  <span className={styles.cardTitle}>
                    <Search size={15} color="#fbbf24" /> {d.name}
                  </span>
                  <span className={styles.tagBadge} style={{ background: `${d.badgeColor}1a`, color: d.badgeColor, borderColor: `${d.badgeColor}40` }}>
                    {d.category}
                  </span>
                </div>
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
                    <ExternalLink size={12} /> Google
                  </a>
                </div>
              </div>
              <div className={styles.dorkQuery}>{d.query}</div>
            </div>
          ))}

        {activeTab === 'github_secrets' &&
          filteredGithubDorks.map((g) => (
            <div key={g.id} className={styles.reconCard}>
              <div className={styles.cardHeader}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                  <span className={styles.cardTitle}>
                    <FileCode size={15} color="#a78bfa" /> {g.name}
                  </span>
                  <span className={styles.tagBadge} style={{ background: `${g.badgeColor}1a`, color: g.badgeColor, borderColor: `${g.badgeColor}40` }}>
                    {g.category}
                  </span>
                </div>
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

        {activeTab === 'shodan_osint' &&
          filteredShodanDorks.map((s) => (
            <div key={s.id} className={styles.reconCard}>
              <div className={styles.cardHeader}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                  <span className={styles.cardTitle}>
                    <Radio size={15} color="#38bdf8" /> {s.name}
                  </span>
                  <span className={styles.tagBadge} style={{ background: `${s.badgeColor}1a`, color: s.badgeColor, borderColor: `${s.badgeColor}40` }}>
                    {s.category}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '0.3rem' }}>
                  <button className={styles.btn} onClick={() => handleCopy(s.id, s.query)}>
                    {copiedId === s.id ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                    {copiedId === s.id ? 'Copied' : 'Copy'}
                  </button>
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noreferrer"
                    className={`${styles.btn} ${styles.btnPrimary}`}
                  >
                    <ExternalLink size={12} /> Search
                  </a>
                </div>
              </div>
              <div className={styles.dorkQuery}>{s.query}</div>
            </div>
          ))}

        {activeTab === 'cloud_s3' &&
          filteredCloudBuckets.map((b) => (
            <div key={b.id} className={styles.reconCard}>
              <div className={styles.cardHeader}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                  <span className={styles.cardTitle}>
                    <Cloud size={15} color="#34d399" /> {b.name}
                  </span>
                  <span className={styles.tagBadge} style={{ background: `${b.badgeColor}1a`, color: b.badgeColor, borderColor: `${b.badgeColor}40` }}>
                    {b.provider}
                  </span>
                </div>
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
                    <ExternalLink size={12} /> Probe
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
