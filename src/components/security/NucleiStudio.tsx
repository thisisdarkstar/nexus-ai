import { useState, useMemo, useEffect } from 'react';
import {
  FileCode,
  Copy,
  Check,
  Download,
  Sparkles,
  Layers,
  RotateCcw,
} from 'lucide-react';
import CustomSelect from '../CustomSelect';
import styles from './NucleiStudio.module.css';

const SEVERITY_OPTIONS = [
  { value: 'critical', label: 'Critical', badge: 'Critical', badgeColor: '#ef4444' },
  { value: 'high', label: 'High', badge: 'High', badgeColor: '#f97316' },
  { value: 'medium', label: 'Medium', badge: 'Medium', badgeColor: '#fbbf24' },
  { value: 'low', label: 'Low', badge: 'Low', badgeColor: '#60a5fa' },
  { value: 'info', label: 'Info', badge: 'Info', badgeColor: '#94a3b8' },
];

const METHOD_OPTIONS = [
  { value: 'GET', label: 'GET' },
  { value: 'POST', label: 'POST' },
  { value: 'PUT', label: 'PUT' },
  { value: 'DELETE', label: 'DELETE' },
  { value: 'PATCH', label: 'PATCH' },
];

const EXTRACTOR_TYPE_OPTIONS = [
  { value: 'regex', label: 'regex — Regex on response body', badge: 'Regex' },
  { value: 'kval', label: 'kval — Key:Value from headers/cookies', badge: 'KV' },
  { value: 'json', label: 'json — JQ-style JSON expression', badge: 'JSON' },
];

const NUCLEI_PRESETS = [
  {
    id: 'exposed-git',
    name: 'Exposed .git Repository Config',
    templateId: 'exposed-git-config',
    vulnerabilityName: 'Exposed Git Configuration File',
    author: 'security-team',
    severity: 'medium' as const,
    tags: 'git,exposure,vcs',
    description: 'Detects exposed .git/config configuration files on web servers.',
    method: 'GET',
    path: '{{BaseURL}}/.git/config',
    matcherStatus: '200',
    matcherWords: '[core], repositoryformatversion',
    matcherCondition: 'and' as const,
  },
  {
    id: 'spring-actuator',
    name: 'Spring Boot Actuator Env Exposure',
    templateId: 'springboot-actuator-env',
    vulnerabilityName: 'Spring Boot Actuator Environment Exposure',
    author: 'security-team',
    severity: 'high' as const,
    tags: 'springboot,actuator,exposure',
    description: 'Detects unauthenticated access to Spring Boot actuator /env endpoint.',
    method: 'GET',
    path: '{{BaseURL}}/actuator/env',
    matcherStatus: '200',
    matcherWords: 'activeProfiles, server.port, spring.datasource',
    matcherCondition: 'or' as const,
  },
  {
    id: 'phpinfo-leak',
    name: 'PHPInfo Sensitive Information Leak',
    templateId: 'phpinfo-leak-detection',
    vulnerabilityName: 'PHPInfo Diagnostic Page Exposed',
    author: 'security-team',
    severity: 'low' as const,
    tags: 'php,info,exposure',
    description: 'Detects publicly accessible phpinfo() diagnostic pages revealing internal environment details.',
    method: 'GET',
    path: '{{BaseURL}}/phpinfo.php',
    matcherStatus: '200',
    matcherWords: 'PHP Version, Configuration File (php.ini) Path',
    matcherCondition: 'and' as const,
  },
];

interface NucleiStudioProps {
  onSendToAI: (prompt: string) => void;
}

const NUCLEI_STORAGE_KEY = 'nexus_security_nuclei_template';

interface NucleiSavedState {
  templateId: string;
  name: string;
  author: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  tags: string;
  description: string;
  method: string;
  path: string;
  headers: string;
  body: string;
  matcherStatus: string;
  matcherWords: string;
  matcherCondition: 'and' | 'or';
  extractorType: '' | 'regex' | 'kval' | 'json';
  extractorName: string;
  extractorPattern: string;
}

const DEFAULT_NUCLEI_STATE: NucleiSavedState = {
  templateId: 'exposed-git-config',
  name: 'Exposed Git Configuration File',
  author: 'security-team',
  severity: 'medium',
  tags: 'git,exposure,vcs',
  description: 'Detects exposed .git/config configuration files on web servers.',
  method: 'GET',
  path: '{{BaseURL}}/.git/config',
  headers: '',
  body: '',
  matcherStatus: '200',
  matcherWords: '[core], repositoryformatversion',
  matcherCondition: 'and',
  extractorType: '',
  extractorName: '',
  extractorPattern: '',
};

export default function NucleiStudio({ onSendToAI }: NucleiStudioProps) {
  const [initialSaved] = useState<NucleiSavedState>(() => {
    try {
      const raw = localStorage.getItem(NUCLEI_STORAGE_KEY);
      if (raw) {
        return { ...DEFAULT_NUCLEI_STATE, ...JSON.parse(raw) };
      }
    } catch (e) {
      console.error('Failed to load nuclei template from localStorage:', e);
    }
    return DEFAULT_NUCLEI_STATE;
  });

  const [templateId, setTemplateId] = useState(initialSaved.templateId);
  const [name, setName] = useState(initialSaved.name);
  const [author, setAuthor] = useState(initialSaved.author);
  const [severity, setSeverity] = useState<'critical' | 'high' | 'medium' | 'low' | 'info'>(initialSaved.severity);
  const [tags, setTags] = useState(initialSaved.tags);
  const [description, setDescription] = useState(initialSaved.description);

  const [method, setMethod] = useState(initialSaved.method);
  const [path, setPath] = useState(initialSaved.path);
  const [headers, setHeaders] = useState(initialSaved.headers);
  const [body, setBody] = useState(initialSaved.body);

  const [matcherStatus, setMatcherStatus] = useState(initialSaved.matcherStatus);
  const [matcherWords, setMatcherWords] = useState(initialSaved.matcherWords);
  const [matcherCondition, setMatcherCondition] = useState<'and' | 'or'>(initialSaved.matcherCondition);

  const [extractorType, setExtractorType] = useState<'' | 'regex' | 'kval' | 'json'>(initialSaved.extractorType);
  const [extractorName, setExtractorName] = useState(initialSaved.extractorName);
  const [extractorPattern, setExtractorPattern] = useState(initialSaved.extractorPattern);

  const [copied, setCopied] = useState(false);

  useEffect(() => {
    try {
      const stateToSave: NucleiSavedState = {
        templateId,
        name,
        author,
        severity,
        tags,
        description,
        method,
        path,
        headers,
        body,
        matcherStatus,
        matcherWords,
        matcherCondition,
        extractorType,
        extractorName,
        extractorPattern,
      };
      localStorage.setItem(NUCLEI_STORAGE_KEY, JSON.stringify(stateToSave));
    } catch (e) {
      console.error('Failed to save nuclei template to localStorage:', e);
    }
  }, [
    templateId,
    name,
    author,
    severity,
    tags,
    description,
    method,
    path,
    headers,
    body,
    matcherStatus,
    matcherWords,
    matcherCondition,
    extractorType,
    extractorName,
    extractorPattern,
  ]);

  const handleSelectPreset = (presetId: string) => {
    const p = NUCLEI_PRESETS.find((preset) => preset.id === presetId);
    if (!p) return;
    setTemplateId(p.templateId);
    setName(p.vulnerabilityName);
    setAuthor(p.author);
    setSeverity(p.severity);
    setTags(p.tags);
    setDescription(p.description);
    setMethod(p.method);
    setPath(p.path);
    setMatcherStatus(p.matcherStatus);
    setMatcherWords(p.matcherWords);
    setMatcherCondition(p.matcherCondition);
    setExtractorType('');
    setExtractorName('');
    setExtractorPattern('');
  };

  const handleClear = () => {
    setTemplateId('');
    setName('');
    setAuthor('');
    setSeverity('high');
    setTags('');
    setDescription('');
    setMethod('GET');
    setPath('');
    setHeaders('');
    setBody('');
    setMatcherStatus('200');
    setMatcherWords('');
    setMatcherCondition('or');
    setExtractorType('');
    setExtractorName('');
    setExtractorPattern('');
  };

  const yamlContent = useMemo(() => {
    const wordsList = matcherWords
      ? matcherWords
          .split(',')
          .map((w) => w.trim().replace(/^["']|["']$/g, ''))
          .filter(Boolean)
      : [];

    const headersList = headers
      ? headers
          .split('\n')
          .map((h) => h.trim())
          .filter(Boolean)
      : [];

    const idVal = templateId.trim() || 'custom-template-id';
    const nameVal = name.trim() || 'Vulnerability Name Example';
    const authorVal = author.trim() || 'security-researcher';
    const descVal = description.trim() || 'Vulnerability description and security impact details...';
    const tagsVal = tags.trim() || 'cve,exposure';
    const pathVal = path.trim() ? path.replace('{{BaseURL}}', '') : '/api/v1/target/endpoint';

    let y = `id: ${idVal}

info:
  name: ${nameVal}
  author: ${authorVal}
  severity: ${severity}
  description: ${descVal}
  tags: ${tagsVal}

http:
  - raw:
      - |
        ${method} ${pathVal} HTTP/1.1
        Host: {{Hostname}}
`;

    headersList.forEach((h) => {
      y += `        ${h}\n`;
    });

    if (body.trim()) {
      y += `\n        ${body}\n`;
    }

    y += `
    matchers-condition: ${matcherCondition}
    matchers:
      - type: status
        status:
          - ${matcherStatus || '200'}
`;

    if (wordsList.length > 0) {
      y += `
      - type: word
        words:
`;
      wordsList.forEach((w) => {
        y += `          - "${w}"\n`;
      });
      y += `        part: body\n`;
    }

    // Optional Extractors (regex / kval / json) for dynamic value extraction
    const hasExtractor = Boolean(
      extractorType && extractorPattern.trim()
    );
    if (hasExtractor) {
      const extKey = extractorType === 'regex' ? 'regex' : extractorType === 'kval' ? 'kval' : 'json';
      const patternLines = extractorPattern
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean);

      y += `
    extractors:
      - type: ${extractorType}
`;
      if (extractorName.trim()) {
        y += `        name: ${extractorName.trim()}\n`;
      }
      y += `        ${extKey}:\n`;
      patternLines.forEach((p) => {
        y += `          - "${p}"\n`;
      });
      y += `        internal: true\n`;
    }

    return y;
  }, [
    templateId,
    name,
    author,
    severity,
    tags,
    description,
    method,
    path,
    headers,
    body,
    matcherStatus,
    matcherWords,
    matcherCondition,
    extractorType,
    extractorName,
    extractorPattern,
  ]);

  const handleCopy = () => {
    navigator.clipboard.writeText(yamlContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleDownload = () => {
    const blob = new Blob([yamlContent], { type: 'text/yaml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${templateId || 'nuclei-template'}.yaml`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleAIRefine = () => {
    const prompt = `I am developing a ProjectDiscovery Nuclei v3 YAML vulnerability scanner template.
Here is the draft template:

\`\`\`yaml
${yamlContent}
\`\`\`

Please review and enhance this template:
1. Validate Nuclei v3 syntax and matcher conditions.
2. Add precise regex extractors and dynamic DSL matchers if applicable.
3. Suggest evasion payloads or multi-step request chains (e.g. CSRF token extraction before POST).`;
    onSendToAI(prompt);
  };

  return (
    <div className={styles.nucleiContainer}>
      {/* Top Controls */}
      <div className={styles.topBar}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', fontWeight: 600 }}>
            <FileCode size={15} color="var(--accent-color)" />
            Nuclei v3 YAML Builder
          </div>
          <CustomSelect
            value=""
            placeholder="Load Sample Preset..."
            options={NUCLEI_PRESETS.map((p) => ({
              value: p.id,
              label: p.name,
              badge: p.severity.toUpperCase(),
            }))}
            onChange={(val) => handleSelectPreset(val)}
            style={{ minWidth: '220px' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
          <button className={styles.btn} onClick={handleClear} title="Clear all fields">
            <RotateCcw size={12} /> Clear
          </button>
          <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleAIRefine}>
            <Sparkles size={13} /> Refine with AI
          </button>
        </div>
      </div>

      {/* Editor Grid */}
      <div className={styles.editorGrid}>
        {/* Left: Interactive Form */}
        <div className={styles.formPane}>
          <div className={styles.twoCol}>
            <div className={styles.formGroup}>
              <label className={styles.label}>Template ID</label>
              <input
                className={styles.input}
                value={templateId}
                placeholder="e.g. cve-2024-1234-auth-bypass"
                onChange={(e) => setTemplateId(e.target.value)}
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label}>Severity</label>
              <CustomSelect
                value={severity}
                options={SEVERITY_OPTIONS}
                onChange={(val) => setSeverity(val as typeof severity)}
              />
            </div>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Vulnerability Name</label>
            <input
              className={styles.input}
              value={name}
              placeholder="e.g. Exposed Administrative Dashboard"
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className={styles.twoCol}>
            <div className={styles.formGroup}>
              <label className={styles.label}>Author</label>
              <input
                className={styles.input}
                value={author}
                placeholder="e.g. security-researcher"
                onChange={(e) => setAuthor(e.target.value)}
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label}>Tags (comma separated)</label>
              <input
                className={styles.input}
                value={tags}
                placeholder="e.g. cve,exposure,auth-bypass,admin"
                onChange={(e) => setTags(e.target.value)}
              />
            </div>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Description</label>
            <input
              className={styles.input}
              value={description}
              placeholder="e.g. Detects unauthenticated access to internal configuration endpoints."
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className={styles.twoCol}>
            <div className={styles.formGroup}>
              <label className={styles.label}>HTTP Method</label>
              <CustomSelect
                value={method}
                options={METHOD_OPTIONS}
                onChange={(val) => setMethod(val)}
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label}>Status Matcher</label>
              <input
                className={styles.input}
                value={matcherStatus}
                placeholder="e.g. 200, 302"
                onChange={(e) => setMatcherStatus(e.target.value)}
              />
            </div>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Request Path</label>
            <input
              className={styles.input}
              value={path}
              placeholder="e.g. {{BaseURL}}/admin/config/settings"
              onChange={(e) => setPath(e.target.value)}
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Match Words (comma separated)</label>
            <input
              className={styles.input}
              value={matcherWords}
              placeholder='e.g. "admin_dashboard", "database_host", "private_key"'
              onChange={(e) => setMatcherWords(e.target.value)}
            />
          </div>

          {/* Optional Extractors Section */}
          <div className={styles.extractorSection}>
            <div className={styles.extractorHeader}>
              <label className={styles.label}>Extractors (optional)</label>
              {extractorType && (
                <button
                  className={styles.btn}
                  style={{ padding: '0.15rem 0.5rem', fontSize: '0.7rem' }}
                  onClick={() => {
                    setExtractorType('');
                    setExtractorName('');
                    setExtractorPattern('');
                  }}
                  title="Remove extractor"
                >
                  Remove
                </button>
              )}
            </div>
            <div className={styles.twoCol}>
              <div className={styles.formGroup}>
                <label className={styles.label}>Type</label>
                <CustomSelect
                  value={extractorType}
                  placeholder="No extractor"
                  options={EXTRACTOR_TYPE_OPTIONS}
                  onChange={(val) => {
                    if (!val) {
                      setExtractorType('');
                      setExtractorName('');
                      setExtractorPattern('');
                    } else {
                      setExtractorType(val as 'regex' | 'kval' | 'json');
                    }
                  }}
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Internal Name</label>
                <input
                  className={styles.input}
                  value={extractorName}
                  placeholder="e.g. session_token"
                  disabled={!extractorType}
                  onChange={(e) => setExtractorName(e.target.value)}
                />
              </div>
            </div>
            {extractorType && (
              <div className={styles.formGroup}>
                <label className={styles.label}>
                  {extractorType === 'regex'
                    ? 'Regex Patterns (comma separated)'
                    : extractorType === 'kval'
                    ? 'Key Names (comma separated)'
                    : 'JQ Expressions (comma separated)'}
                </label>
                <input
                  className={styles.input}
                  value={extractorPattern}
                  placeholder={
                    extractorType === 'regex'
                      ? 'e.g. "session=[a-z0-9]{32}", "csrf=([a-zA-Z0-9]+)"'
                      : extractorType === 'kval'
                      ? 'e.g. session, csrf_token'
                      : "e.g. .data.token, .user.id"
                  }
                  onChange={(e) => setExtractorPattern(e.target.value)}
                />
              </div>
            )}
          </div>
        </div>

        {/* Right: Live YAML Preview */}
        <div className={styles.yamlPane}>
          <div className={styles.paneHeader}>
            <span className={styles.paneTitle}>
              <Layers size={14} color="#10b981" /> Live Nuclei YAML
            </span>
            <div style={{ display: 'flex', gap: '0.3rem' }}>
              <button className={styles.btn} onClick={handleCopy}>
                {copied ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                {copied ? 'Copied' : 'Copy'}
              </button>
              <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleDownload}>
                <Download size={12} /> Download .yaml
              </button>
            </div>
          </div>

          <pre className={styles.yamlBox}>{yamlContent}</pre>
        </div>
      </div>
    </div>
  );
}
