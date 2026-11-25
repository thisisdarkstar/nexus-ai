import { projectLocalStorage } from '../../core/storage/projectStorage';
import { eventBus } from '../../core/bus/EventBus';
import React, { useState, useMemo, useEffect, useRef } from 'react';
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
  ShieldAlert,
  Radar,
  Zap,
  Play,
  Trash2,
  FolderUp,
  RefreshCw,
  Target,
  AlertTriangle,
  Layers,
  ArrowRight,
  Key,
  FileSearch,
  Lock,
  Plus,
  BookOpen,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';
import CustomSelect from '../common/CustomSelect';
import { workbenchBridge } from '../../lib/security/workbenchBridge';
import { parseSecurityArtifact } from '../../lib/security/artifactParsers';
import { ingestionService } from '../../services/IngestionService';
import { correlationService } from '../../domain/intelligence/CorrelationService';
import {
  extractFromJavaScript,
  SAMPLE_JS_BUNDLE,
  type ExtractedSecret,
  type ExtractedEndpoint,
} from '../../lib/security/jsExtractor';
import type { ReconAsset, ScopeItem } from '../../types';
import styles from './ReconHub.module.css';

interface ReconHubProps {
  onSendToAI: (prompt: string) => void;
}

type ReconTab = 'surface_explorer' | 'js_secrets' | 'pipelines' | 'google_dorks' | 'github_secrets' | 'cloud_s3';

const RECON_TARGET_STORAGE_KEY = 'nexus_security_recon_target';
const RECON_ASSETS_STORAGE_KEY = 'nexus_security_recon_assets';

import ReconJsExtractorTab from './ReconJsExtractorTab';
import ReconOsintTab from './ReconOsintTab';
import {
  SAMPLE_BOUNTY_ASSETS,
  buildReconPipelines,
  buildGoogleDorks,
  buildGithubDorks,
  buildCloudBuckets,
} from '../../lib/security/reconPresets';

export { SAMPLE_BOUNTY_ASSETS };

export default function ReconHub({ onSendToAI }: ReconHubProps) {
  const [targetDomain, setTargetDomain] = useState(() => {
    return projectLocalStorage.getItem(RECON_TARGET_STORAGE_KEY) || 'acmefinance.com';
  });

  const [assets, setAssets] = useState<ReconAsset[]>(() => {
    try {
      const saved = projectLocalStorage.getItem(RECON_ASSETS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error(e);
    }
    return SAMPLE_BOUNTY_ASSETS;
  });

  useEffect(() => {
    try {
      projectLocalStorage.setItem(RECON_TARGET_STORAGE_KEY, targetDomain);
    } catch (e) {
      console.error(e);
    }
  }, [targetDomain]);

  useEffect(() => {
    try {
      projectLocalStorage.setItem(RECON_ASSETS_STORAGE_KEY, JSON.stringify(assets));
    } catch (e) {
      console.error(e);
    }
  }, [assets]);

  // Listen for newly ingested recon assets from ArtifactIngestModal or other sources
  useEffect(() => {
    return eventBus.subscribe('workbench:add-recon-assets', (incoming) => {
      setAssets((prev) => {
        const map = new Map<string, ReconAsset>();
        prev.forEach((a) => map.set(a.url.toLowerCase(), a));
        incoming.forEach((a) => map.set(a.url.toLowerCase(), a));
        return Array.from(map.values());
      });
    });
  }, []);

  const [activeTab, setActiveTab] = useState<ReconTab>('surface_explorer');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Surface Explorer Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [riskFilter, setRiskFilter] = useState<string>('all');
  const [techFilter, setTechFilter] = useState<string>('all');
  const [expandedAdvisories, setExpandedAdvisories] = useState<Record<string, boolean>>({});

  const fileInputRef = useRef<HTMLInputElement>(null);

  const cleanDomain = useMemo(() => {
    return (
      targetDomain
        .replace(/^https?:\/\//i, '')
        .replace(/\/.*$/, '')
        .replace(/^\*\./, '')
        .trim() || 'acmefinance.com'
    );
  }, [targetDomain]);

  // Extract all distinct technologies from discovered assets for dropdown
  const allTechnologies = useMemo(() => {
    const set = new Set<string>();
    assets.forEach((a) => {
      (a.technologies || []).forEach((t) => set.add(t));
      if (a.webserver) set.add(a.webserver);
    });
    return Array.from(set).sort();
  }, [assets]);

  // Filtered Assets
  const filteredAssets = useMemo(() => {
    return assets.filter((asset) => {
      // 1. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesUrl = asset.url.toLowerCase().includes(q);
        const matchesTitle = (asset.title || '').toLowerCase().includes(q);
        const matchesHost = asset.host.toLowerCase().includes(q);
        const matchesTech = (asset.technologies || []).some((t) => t.toLowerCase().includes(q));
        if (!matchesUrl && !matchesTitle && !matchesHost && !matchesTech) return false;
      }

      // 2. Status Code Filter
      if (statusFilter !== 'all') {
        const code = asset.statusCode || 200;
        if (statusFilter === '200' && code !== 200) return false;
        if (statusFilter === '3xx' && (code < 300 || code >= 400)) return false;
        if (statusFilter === '4xx' && (code < 400 || code >= 500)) return false;
        if (statusFilter === '5xx' && code < 500) return false;
      }

      // 3. Risk / Anomaly Filter
      if (riskFilter !== 'all') {
        if (riskFilter === 'high_interest') {
          if (!asset.highInterestFlags || asset.highInterestFlags.length === 0) return false;
        } else if (riskFilter === 'critical') {
          if (asset.riskScore !== 'critical') return false;
        } else if (riskFilter === 'ssrf') {
          if (!asset.highInterestFlags?.some((f) => f.includes('SSRF'))) return false;
        } else if (riskFilter === 'idor') {
          if (!asset.highInterestFlags?.some((f) => f.includes('IDOR'))) return false;
        }
      }

      // 4. Tech Filter
      if (techFilter !== 'all') {
        const hasTech =
          (asset.technologies || []).includes(techFilter) || asset.webserver === techFilter;
        if (!hasTech) return false;
      }

      return true;
    });
  }, [assets, searchQuery, statusFilter, riskFilter, techFilter]);

  // Metrics
  const metrics = useMemo(() => {
    const total = assets.length;
    const criticalHigh = assets.filter((a) => a.riskScore === 'critical' || a.riskScore === 'high').length;
    const anomalies = assets.filter((a) => (a.highInterestFlags || []).length > 0).length;
    const live200 = assets.filter((a) => a.statusCode === 200).length;
    return { total, criticalHigh, anomalies, live200 };
  }, [assets]);

  // 1-Click Action: Replay in HTTP Studio
  const handleReplayInHttp = (asset: ReconAsset) => {
    try {
      const urlObj = new URL(asset.url);
      const rawReq = `GET ${urlObj.pathname || '/'}${urlObj.search || ''} HTTP/1.1\nHost: ${asset.host}\nUser-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) NexusBounty/2.0\nAccept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8\nAccept-Language: en-US,en;q=0.5\nConnection: close\n\n`;
      workbenchBridge.loadHttp(rawReq);
    } catch {
      workbenchBridge.loadHttp(`GET / HTTP/1.1\nHost: ${asset.host}\n\n`);
    }
  };

  // 1-Click Action: Add to Scope
  const handleAddToScope = (asset: ReconAsset) => {
    const scopeItem: ScopeItem = {
      id: `scope-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      target: asset.url,
      type: 'domain',
      inScope: true,
      techStack: asset.technologies || [asset.webserver || 'Web'],
      notes: `Recon finding: [${asset.statusCode || 200}] ${asset.title || asset.host}`,
      status: 'untested',
    };
    workbenchBridge.addScopeItems([scopeItem]);
  };

  // 1-Click Action: Add all filtered to scope
  const handleAddAllFilteredToScope = () => {
    const scopeItems: ScopeItem[] = filteredAssets.map((asset, idx) => ({
      id: `scope-bulk-${idx}-${Date.now()}`,
      target: asset.url,
      type: 'domain',
      inScope: true,
      techStack: asset.technologies || ['Web'],
      notes: `Bulk Recon Ingestion: [${asset.statusCode || 200}] ${asset.title || asset.host}`,
      status: 'untested',
    }));
    workbenchBridge.addScopeItems(scopeItems);
  };

  // 1-Click Action: Build Nuclei Template
  const handleCreateNuclei = (asset: ReconAsset) => {
    let parsedPath = '{{BaseURL}}/';
    try {
      const u = new URL(asset.url);
      parsedPath = `{{BaseURL}}${u.pathname || '/'}${u.search || ''}`;
    } catch {
      // fallback
    }

    const hostSlug = asset.host.replace(/[^a-z0-9]/gi, '-').toLowerCase();
    const flagsString = (asset.highInterestFlags || []).join(', ');

    let matcherWords = '"root:", "admin", "password", "token"';
    if (flagsString.includes('Spring')) {
      matcherWords = '"spring.application.name", "server.port", "JAVA_HOME"';
    } else if (flagsString.includes('Swagger')) {
      matcherWords = '"swagger", "openapi", "paths"';
    } else if (flagsString.includes('GraphQL')) {
      matcherWords = '"__schema", "queryType", "mutationType"';
    } else if (flagsString.includes('Config')) {
      matcherWords = '"DB_PASSWORD", "AWS_ACCESS_KEY_ID", "SECRET_KEY"';
    } else if (flagsString.includes('SSRF')) {
      matcherWords = '"ami-id", "instance-id", "metadata"';
    }

    workbenchBridge.loadNuclei({
      templateId: `${hostSlug}-check`,
      name: `${asset.title || asset.host} - Vulnerability Verification`,
      path: parsedPath,
      severity: asset.riskScore || 'high',
      tags: ['bounty', 'recon', ...(asset.technologies || []).map((t) => t.toLowerCase().replace(/\s+/g, '-'))].join(','),
      description: `Automated vulnerability verification template for ${asset.url}. Flagged anomalies: ${flagsString || 'Recon finding'}.`,
      matcherWords,
    });
  };

  // 1-Click Action: Ask AI for tailored Attack Vector
  const handleAIAttackPlan = (asset: ReconAsset) => {
    const prompt = `Analyze target asset **${asset.url}** in our active penetration test:
- **Host / IP**: \`${asset.host}\` (Port: ${asset.port || 443})
- **Status Code**: \`${asset.statusCode || 200}\`
- **Page Title**: "${asset.title || 'N/A'}"
- **Tech Stack**: \`${(asset.technologies || []).join(', ') || asset.webserver || 'Web'}\`
- **Flagged Anomalies**: \`${(asset.highInterestFlags || []).join(', ') || 'General Target'}\`
- **Risk Classification**: ${asset.riskScore?.toUpperCase() || 'INFO'}

Please formulate an aggressive bug bounty testing plan for this endpoint:
1. Explain how to test for the flagged anomalies (e.g. bypass tricks, token extraction, or SSRF payloads).
2. Provide exact \`curl\` commands with appropriate headers to verify vulnerability.
3. Suggest 3 specific fuzzing wordlists and payload patterns for this technology.`;
    onSendToAI(prompt);
  };

  // Ingest Recon File (httpx JSON, text, subdomains, endpoints)
  const handleFileProcess = (file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      if (text) {
        try {
          const result = await ingestionService.ingestFile(text, file.name);
          if (result.reconAssets && result.reconAssets.length > 0) {
            setAssets((prev) => {
              const map = new Map<string, ReconAsset>();
              prev.forEach((a) => map.set(a.url.toLowerCase(), a));
              result.reconAssets!.forEach((a) => map.set(a.url.toLowerCase(), a));
              return Array.from(map.values());
            });
            if (result.scopeItems.length > 0) {
              workbenchBridge.addScopeItems(result.scopeItems);
            }
          }
        } catch (err) {
          console.error('Ingestion failed in ReconHub:', err);
        }
      }
    };
    reader.readAsText(file);
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  // JS Secret & Endpoint Extractor State
  const [jsInput, setJsInput] = useState<string>(SAMPLE_JS_BUNDLE);
  const jsFileInputRef = useRef<HTMLInputElement>(null);
  const [jsFilter, setJsFilter] = useState<'all' | 'secrets' | 'endpoints'>('all');

  const jsResult = useMemo(() => {
    return extractFromJavaScript(jsInput, cleanDomain);
  }, [jsInput, cleanDomain]);

  const handleAddJsEndpointsToAttackSurface = () => {
    const newAssets: ReconAsset[] = jsResult.endpoints.map((ep, idx) => ({
      id: `js-asset-${idx}-${Date.now()}`,
      url: ep.url,
      host: cleanDomain,
      port: 443,
      protocol: 'https',
      statusCode: 200,
      title: `JS Route: ${ep.path}`,
      webserver: 'Discovered in JS Bundle',
      technologies: ['JavaScript Bundle'],
      riskScore: ep.riskScore,
      highInterestFlags: ep.flags,
      source: 'js_extract',
      createdAt: Date.now(),
    }));

    setAssets((prev) => {
      const map = new Map<string, ReconAsset>();
      prev.forEach((a) => map.set(a.url.toLowerCase(), a));
      newAssets.forEach((a) => map.set(a.url.toLowerCase(), a));
      return Array.from(map.values());
    });
    setActiveTab('surface_explorer');
  };

  const handleCreateSecretFinding = (secret: ExtractedSecret) => {
    workbenchBridge.addFinding({
      id: `finding-sec-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      title: `Hardcoded Credential Exposure: ${secret.name}`,
      severity: secret.severity,
      cweId: secret.cwe || 'CWE-798',
      targetEndpoint: `${cleanDomain} (Bundle Line ${secret.line})`,
      description: `${secret.description}\n\n**Discovered Secret Preview**: \`${secret.preview}\`\n**Full Leaked Token**: \`${secret.value}\``,
      remediation:
        'Immediately revoke the leaked token or API key, rotate credentials, and purge secrets from client-side bundles using environment variables or a secrets manager.',
    });
    workbenchBridge.switchTab('reports');
  };

  const handleAISecretPoC = (secret: ExtractedSecret) => {
    const prompt = `During JavaScript bundle analysis of **${cleanDomain}**, I discovered an exposed credential:
- **Secret Type**: \`${secret.name}\` (${secret.type})
- **Severity**: ${secret.severity.toUpperCase()}
- **CWE**: ${secret.cwe}
- **Value**: \`${secret.value}\`
- **Location**: Line ${secret.line}

Please provide:
1. Safe steps to verify if this token is active without causing damage (e.g. AWS \`sts get-caller-identity\`, Stripe \`GET /v1/charges\`, or Slack API auth test).
2. Bug bounty impact statement explaining the risk for HackerOne / Bugcrowd submission.
3. Strict remediation advice for client-side bundle stripping.`;
    onSendToAI(prompt);
  };

  const handleJsFileProcess = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (text) {
        setJsInput(text);
      }
    };
    reader.readAsText(file);
  };

  const pipelines = useMemo(() => buildReconPipelines(cleanDomain), [cleanDomain]);
  const googleDorks = useMemo(() => buildGoogleDorks(cleanDomain), [cleanDomain]);
  const githubDorks = useMemo(() => buildGithubDorks(cleanDomain), [cleanDomain]);
  const cloudBuckets = useMemo(() => buildCloudBuckets(cleanDomain), [cleanDomain]);

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
        <button
          className={`${styles.btn} ${styles.btnPrimary}`}
          onClick={() => {
            const prompt = `I am conducting an authorized penetration test on target: **${cleanDomain}**.
Generate an end-to-end OSINT and Reconnaissance Attack Plan tailored specifically for this domain:

1. **Subdomain Takeover & CNAME Patterns**: Common cloud services and DNS checks.
2. **High-Yield Search Queries & Dorks**: Specific dorks for GitHub, Shodan, Censys, and SecurityTrails.
3. **API & Hidden Endpoint Strategy**: Framework-specific paths to probe.
4. **Cloud Asset Discovery**: Cloud storage bucket enumeration commands.`;
            onSendToAI(prompt);
          }}
        >
          <Sparkles size={13} /> AI Recon Plan
        </button>
      </div>

      {/* Sub Tabs Bar */}
      <div className={styles.topBar}>
        <div className={styles.tabGroup}>
          <button
            className={`${styles.subTab} ${activeTab === 'surface_explorer' ? styles.active : ''}`}
            onClick={() => setActiveTab('surface_explorer')}
          >
            <Radar size={12} /> Live Attack Surface ({assets.length})
          </button>
          <button
            className={`${styles.subTab} ${activeTab === 'js_secrets' ? styles.active : ''}`}
            onClick={() => setActiveTab('js_secrets')}
          >
            <Key size={12} /> JS Secret Extractor {jsResult.secrets.length > 0 && `(${jsResult.secrets.length})`}
          </button>
          <button
            className={`${styles.subTab} ${activeTab === 'pipelines' ? styles.active : ''}`}
            onClick={() => setActiveTab('pipelines')}
          >
            <Terminal size={12} /> CLI Pipelines
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

        {activeTab === 'surface_explorer' && (
          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: 'none' }}
              accept=".json,.jsonl,.txt"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFileProcess(e.target.files[0]);
                }
              }}
            />
            <button
              className={`${styles.btn} ${styles.btnPrimary}`}
              onClick={() => fileInputRef.current?.click()}
              title="Ingest Httpx JSON, subdomains.txt, or endpoints.txt"
            >
              <FolderUp size={12} /> Ingest Recon File
            </button>
            <button
              className={styles.btn}
              onClick={() => setAssets(SAMPLE_BOUNTY_ASSETS)}
              title="Reset to sample enterprise bug bounty dataset"
            >
              <RefreshCw size={12} /> Sample Data
            </button>
            {assets.length > 0 && (
              <button
                className={styles.btn}
                onClick={() => setAssets([])}
                title="Clear all recon assets"
                style={{ color: '#ef4444' }}
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>
        )}

        {activeTab === 'js_secrets' && (
          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
            <input
              type="file"
              ref={jsFileInputRef}
              style={{ display: 'none' }}
              accept=".js,.txt,.json"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleJsFileProcess(e.target.files[0]);
                }
              }}
            />
            <button
              className={`${styles.btn} ${styles.btnPrimary}`}
              onClick={() => jsFileInputRef.current?.click()}
              title="Upload any JavaScript bundle (.js) to extract secrets and endpoints"
            >
              <FolderUp size={12} /> Ingest .JS Bundle
            </button>
            <button
              className={styles.btn}
              onClick={() => setJsInput(SAMPLE_JS_BUNDLE)}
              title="Reset to sample React/Webpack minified bundle"
            >
              <RefreshCw size={12} /> Sample Bundle
            </button>
            {jsResult.endpoints.length > 0 && (
              <button
                className={styles.btn}
                onClick={handleAddJsEndpointsToAttackSurface}
                title="Add all discovered routes into the Live Attack Surface"
                style={{ color: '#10b981', borderColor: 'rgba(16,185,129,0.3)' }}
              >
                <Target size={12} /> Export ({jsResult.endpoints.length}) to Surface
              </button>
            )}
          </div>
        )}
      </div>

      {/* Surface Explorer View */}
      {activeTab === 'surface_explorer' && (
        <>
          {/* Key Metric Tiles */}
          <div className={styles.metricsStrip}>
            <div className={styles.metricCard}>
              <div className={styles.metricInfo}>
                <span className={styles.metricLabel}>Total Assets</span>
                <span className={styles.metricValue}>{metrics.total}</span>
              </div>
              <Globe size={18} color="#38bdf8" />
            </div>

            <div className={styles.metricCard}>
              <div className={styles.metricInfo}>
                <span className={styles.metricLabel}>High Interest</span>
                <span className={styles.metricValue} style={{ color: '#ef4444' }}>
                  {metrics.criticalHigh}
                </span>
              </div>
              <ShieldAlert size={18} color="#ef4444" />
            </div>

            <div className={styles.metricCard}>
              <div className={styles.metricInfo}>
                <span className={styles.metricLabel}>Bounty Anomalies</span>
                <span className={styles.metricValue} style={{ color: '#f59e0b' }}>
                  {metrics.anomalies}
                </span>
              </div>
              <Zap size={18} color="#f59e0b" />
            </div>

            <div className={styles.metricCard}>
              <div className={styles.metricInfo}>
                <span className={styles.metricLabel}>Live 200 OK</span>
                <span className={styles.metricValue} style={{ color: '#10b981' }}>
                  {metrics.live200}
                </span>
              </div>
              <Check size={18} color="#10b981" />
            </div>
          </div>

          {/* Filtering & Search Bar */}
          <div className={styles.explorerControls}>
            <div className={styles.filterGroup}>
              <input
                className={styles.searchInput}
                placeholder="Filter by URL, path, title, or server..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />

              {/* Status Code Filter */}
              <CustomSelect
                value={statusFilter}
                onChange={setStatusFilter}
                options={[
                  { value: 'all', label: 'All Statuses' },
                  { value: '200', label: '200 OK' },
                  { value: '3xx', label: '3xx Redirect' },
                  { value: '4xx', label: '4xx Client / Auth' },
                  { value: '5xx', label: '5xx Server Error' },
                ]}
                style={{ minWidth: '125px' }}
              />

              {/* Risk / Anomaly Filter */}
              <CustomSelect
                value={riskFilter}
                onChange={setRiskFilter}
                options={[
                  { value: 'all', label: 'All Risks' },
                  { value: 'high_interest', label: '🎯 High Interest Only' },
                  { value: 'critical', label: '🔴 Critical Only' },
                  { value: 'ssrf', label: '⚡ SSRF Candidates' },
                  { value: 'idor', label: '🔑 IDOR Candidates' },
                ]}
                style={{ minWidth: '155px' }}
              />

              {/* Tech Filter */}
              <CustomSelect
                value={techFilter}
                onChange={setTechFilter}
                options={[
                  { value: 'all', label: 'All Technologies' },
                  ...allTechnologies.map((t) => ({ value: t, label: t })),
                ]}
                style={{ minWidth: '145px' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
              <button
                className={styles.btn}
                onClick={handleAddAllFilteredToScope}
                title="Send all filtered assets to ScopeManager"
              >
                <Target size={12} color="#38bdf8" /> Add ({filteredAssets.length}) to Scope
              </button>
            </div>
          </div>

          {/* Asset List */}
          {filteredAssets.length === 0 ? (
            <div className={styles.emptyState}>
              <Radar size={32} color="#64748b" />
              <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>No recon assets found</span>
              <span style={{ fontSize: '0.78rem' }}>
                Adjust your filters, ingest a new recon file (httpx, subdomains, endpoints), or reset to sample data.
              </span>
              <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => setAssets(SAMPLE_BOUNTY_ASSETS)}>
                Load Sample Bug Bounty Data
              </button>
            </div>
          ) : (
            <div className={styles.assetList}>
              {filteredAssets.map((asset) => {
                const code = asset.statusCode || 200;
                const statusClass =
                  code >= 200 && code < 300
                    ? styles.status2xx
                    : code >= 300 && code < 400
                      ? styles.status3xx
                      : code >= 400 && code < 500
                        ? styles.status4xx
                        : styles.status5xx;

                const riskClass =
                  asset.riskScore === 'critical'
                    ? styles.assetCardCritical
                    : asset.riskScore === 'high'
                      ? styles.assetCardHigh
                      : asset.riskScore === 'medium'
                        ? styles.assetCardMedium
                        : asset.riskScore === 'low'
                          ? styles.assetCardLow
                          : styles.assetCardInfo;

                const riskBadgeClass =
                  asset.riskScore === 'critical'
                    ? styles.riskCritical
                    : asset.riskScore === 'high'
                      ? styles.riskHigh
                      : asset.riskScore === 'medium'
                        ? styles.riskMedium
                        : asset.riskScore === 'low'
                          ? styles.riskLow
                          : styles.riskInfo;

                return (
                  <div key={asset.id} className={`${styles.assetCard} ${riskClass}`}>
                    <div className={styles.assetHeader}>
                      <div className={styles.assetTitleRow}>
                        <span className={`${styles.statusBadge} ${statusClass}`}>{code}</span>
                        {asset.riskScore && (
                          <span className={`${styles.riskBadge} ${riskBadgeClass}`}>
                            {asset.riskScore}
                          </span>
                        )}
                        <span className={styles.assetTitle} title={asset.title || asset.host}>
                          {asset.title || asset.host}
                        </span>
                      </div>

                      <div className={styles.metaInfo}>
                        {asset.webserver && <span>Server: {asset.webserver}</span>}
                        {asset.contentLength !== undefined && <span>{asset.contentLength} bytes</span>}
                      </div>
                    </div>

                    <div className={styles.assetUrlRow}>
                      <a
                        href={asset.url}
                        target="_blank"
                        rel="noreferrer"
                        className={styles.assetUrlLink}
                        title="Open asset in browser"
                      >
                        {asset.url}
                      </a>
                      <button
                        className={styles.btn}
                        style={{ padding: '0.15rem 0.4rem', fontSize: '0.68rem' }}
                        onClick={() => handleCopy(asset.id, asset.url)}
                        title="Copy target URL"
                      >
                        {copiedId === asset.id ? <Check size={11} color="#10b981" /> : <Copy size={11} />}
                      </button>
                    </div>

                    {/* Flags / Anomalies */}
                    {asset.highInterestFlags && asset.highInterestFlags.length > 0 && (
                      <div className={styles.flagsRow}>
                        {asset.highInterestFlags.map((flag, idx) => (
                          <span
                            key={idx}
                            className={`${styles.flagBadge} ${
                              flag.includes('IDOR') ? styles.flagBadgeMedium : ''
                            }`}
                          >
                            <Zap size={10} /> {flag}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Technologies */}
                    {asset.technologies && asset.technologies.length > 0 && (
                      <div className={styles.techRow}>
                        {asset.technologies.map((t, idx) => (
                          <span key={idx} className={styles.techPill}>
                            {t}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Security Intelligence Advisory Correlation */}
                    {(() => {
                      const observations = correlationService.correlateAsset(asset);
                      if (observations.length === 0) return null;
                      const isExpanded = !!expandedAdvisories[asset.id];

                      return (
                        <div className={styles.advisoryContainer}>
                          <button
                            className={styles.advisoryTrigger}
                            onClick={() =>
                              setExpandedAdvisories((prev) => ({
                                ...prev,
                                [asset.id]: !prev[asset.id],
                              }))
                            }
                            title="View correlated CWE advisory, defensive checks, and remediation guidance"
                          >
                            <BookOpen size={11} />
                            <span>
                              Advisory: {observations[0].advisory.title} ({observations[0].advisory.cweId})
                            </span>
                            <span
                              className={`${styles.confidenceBadge} ${
                                observations[0].confidence === 'confirmed'
                                  ? styles.confidenceConfirmed
                                  : observations[0].confidence === 'high_confidence'
                                    ? styles.confidenceHigh
                                    : styles.confidenceTentative
                              }`}
                            >
                              {observations[0].confidence}
                            </span>
                            {isExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                          </button>

                          {isExpanded && (
                            <div className={styles.advisoryBox}>
                              <div className={styles.advisoryHeader}>
                                <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                                  <Shield size={12} color="#10b981" />
                                  <span style={{ fontWeight: 600, color: '#f8fafc' }}>
                                    {observations[0].advisory.owaspCategory}
                                  </span>
                                </div>
                                <button
                                  className={`${styles.btn} ${styles.btnPrimary}`}
                                  style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }}
                                  onClick={() => {
                                    const obs = observations[0];
                                    workbenchBridge.addFinding({
                                      id: `f-adv-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                                      title: `${obs.advisory.title} (${asset.host})`,
                                      severity: obs.advisory.severity,
                                      cweId: obs.advisory.cweId,
                                      owaspCategory: obs.advisory.owaspCategory,
                                      targetEndpoint: asset.url,
                                      description: `${obs.advisory.description}\n\n**Discovered Evidence**: ${obs.evidenceText}\n**Confidence Score**: ${obs.confidence.toUpperCase()}`,
                                      remediation: obs.remediation,
                                    });
                                    workbenchBridge.switchTab('reports');
                                  }}
                                  title="Add correlated advisory as a formal finding in ReportStudio"
                                >
                                  <Shield size={10} /> File in Report
                                </button>
                              </div>

                              <div style={{ color: '#cbd5e1', lineHeight: 1.45 }}>
                                {observations[0].advisory.description}
                              </div>

                              <div>
                                <div className={styles.advisorySectionTitle}>Defensive Verification Procedure</div>
                                <div style={{ color: '#94a3b8', fontStyle: 'italic' }}>
                                  {observations[0].suggestedCheck}
                                </div>
                              </div>

                              <div>
                                <div className={styles.advisorySectionTitle}>Remediation Pattern</div>
                                <div
                                  style={{
                                    fontFamily: 'JetBrains Mono, monospace',
                                    color: '#38bdf8',
                                    background: 'rgba(255,255,255,0.03)',
                                    padding: '0.35rem 0.5rem',
                                    borderRadius: '4px',
                                  }}
                                >
                                  {observations[0].remediation}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* Action Toolbar */}
                    <div className={styles.assetActions}>
                      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                        <button
                          className={`${styles.btn} ${styles.btnPrimary}`}
                          onClick={() => handleReplayInHttp(asset)}
                          title="Send to HTTP Studio for live request crafting & replay"
                        >
                          <Play size={11} fill="currentColor" /> Replay in HTTP Studio
                        </button>
                        <button
                          className={styles.btn}
                          onClick={() => handleAddToScope(asset)}
                          title="Add target asset to Scope Manager"
                        >
                          <Target size={11} color="#38bdf8" /> Add to Scope
                        </button>
                        <button
                          className={styles.btn}
                          onClick={() => handleCreateNuclei(asset)}
                          title="Create or test with Nuclei v3 templates"
                        >
                          <Shield size={11} color="#a78bfa" /> Nuclei Template
                        </button>
                      </div>

                      <button
                        className={styles.btn}
                        style={{ color: '#10b981', borderColor: 'rgba(16,185,129,0.3)' }}
                        onClick={() => handleAIAttackPlan(asset)}
                        title="Ask AI to formulate tailored attack vectors and PoC commands"
                      >
                        <Sparkles size={11} /> AI Attack Plan
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* JS Secret & Endpoint Extractor View */}
      {activeTab === 'js_secrets' && (
        <ReconJsExtractorTab
          cleanDomain={cleanDomain}
          jsInput={jsInput}
          setJsInput={setJsInput}
          jsFilter={jsFilter}
          setJsFilter={setJsFilter}
          jsResult={jsResult}
          copiedId={copiedId}
          onCopy={handleCopy}
          onAddEndpointsToSurface={handleAddJsEndpointsToAttackSurface}
          onCreateSecretFinding={handleCreateSecretFinding}
          onAISecretPoC={handleAISecretPoC}
        />
      )}

      {/* Grid Content for Other Tabs */}
      {activeTab !== 'surface_explorer' && activeTab !== 'js_secrets' && (
        <ReconOsintTab
          activeTab={activeTab}
          pipelines={pipelines}
          googleDorks={googleDorks}
          githubDorks={githubDorks}
          cloudBuckets={cloudBuckets}
          copiedId={copiedId}
          onCopy={handleCopy}
        />
      )}
    </div>
  );
}
