import { projectLocalStorage } from '../../core/storage/projectStorage';
import { eventBus } from '../../core/bus/EventBus';
import { useState, useMemo, useEffect } from 'react';
import {
  FileCode,
  Copy,
  Check,
  Download,
  Sparkles,
  Layers,
  RefreshCw,
} from 'lucide-react';
import CustomSelect from '../common/CustomSelect';
import styles from './NucleiStudio.module.css';

const SEVERITY_OPTIONS = [
  { value: 'critical', label: 'Critical' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
  { value: 'info', label: 'Info' },
];

const METHOD_OPTIONS = [
  { value: 'GET', label: 'GET' },
  { value: 'POST', label: 'POST' },
  { value: 'PUT', label: 'PUT' },
  { value: 'DELETE', label: 'DELETE' },
  { value: 'PATCH', label: 'PATCH' },
];

interface NucleiStudioProps {
  onSendToAI: (prompt: string) => void;
}

interface NucleiPreset {
  templateId?: string;
  name?: string;
  path?: string;
  severity?: 'critical' | 'high' | 'medium' | 'low' | 'info';
  tags?: string;
  description?: string;
  method?: string;
  matcherWords?: string;
}

const NUCLEI_PRESET_KEY = 'nexus_security_nuclei_preset';

function loadNucleiPreset(): NucleiPreset {
  try {
    const saved = projectLocalStorage.getItem(NUCLEI_PRESET_KEY);
    return saved ? (JSON.parse(saved) as NucleiPreset) : {};
  } catch {
    return {};
  }
}

export default function NucleiStudio({ onSendToAI }: NucleiStudioProps) {
  // A preset may be published before this lazily mounted module exists, so read the persisted copy on mount.
  const preset = useMemo(loadNucleiPreset, []);
  const [templateId, setTemplateId] = useState(preset.templateId || 'custom-auth-bypass-check');
  const [name, setName] = useState(preset.name || 'Unauthorized Administrative Endpoint Exposure');
  const [author, setAuthor] = useState('nexus-security');
  const [severity, setSeverity] = useState<'critical' | 'high' | 'medium' | 'low' | 'info'>(preset.severity || 'high');
  const [tags, setTags] = useState(preset.tags || 'cve,exposure,auth-bypass,admin');
  const [description, setDescription] = useState(
    preset.description ||
      'Detects unauthenticated access to internal administration dashboard and configuration endpoints.'
  );

  const [method, setMethod] = useState(preset.method || 'GET');
  const [path, setPath] = useState(preset.path || '{{BaseURL}}/admin/config/settings');
  const [headers, setHeaders] = useState('X-Requested-With: XMLHttpRequest\nAccept: application/json');
  const [body, setBody] = useState('');

  const [matcherStatus, setMatcherStatus] = useState('200');
  const [matcherWords, setMatcherWords] = useState(
    preset.matcherWords || '"admin_dashboard", "database_host", "private_key"'
  );
  const [matcherCondition, setMatcherCondition] = useState<'and' | 'or'>('or');

  const [copied, setCopied] = useState(false);

  useEffect(() => {
    return eventBus.subscribe('workbench:load-nuclei', (d) => {
      if (d.templateId) setTemplateId(d.templateId);
      if (d.name) setName(d.name);
      if (d.path) setPath(d.path);
      if (d.severity) setSeverity(d.severity);
      if (d.tags) setTags(d.tags);
      if (d.description) setDescription(d.description);
      if (d.method) setMethod(d.method);
      if (d.matcherWords) setMatcherWords(d.matcherWords);
    });
  }, []);

  const yamlContent = useMemo(() => {
    const wordsList = matcherWords
      .split(',')
      .map((w) => w.trim().replace(/^["']|["']$/g, ''))
      .filter(Boolean);

    const headersList = headers
      .split('\n')
      .map((h) => h.trim())
      .filter(Boolean);

    let y = `id: ${templateId}

info:
  name: ${name}
  author: ${author}
  severity: ${severity}
  description: ${description}
  tags: ${tags}

http:
  - raw:
      - |
        ${method} ${path.replace('{{BaseURL}}', '')} HTTP/1.1
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
          - ${matcherStatus}
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
    a.download = `${templateId}.yaml`;
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', fontWeight: 600 }}>
          <FileCode size={15} color="var(--accent-color)" />
          Nuclei v3 YAML Template Builder
        </div>
        <div style={{ display: 'flex', gap: '0.4rem' }}>
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
                onChange={(e) => setTemplateId(e.target.value)}
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label}>Severity</label>
              <CustomSelect
                value={severity}
                onChange={(val) => setSeverity(val as typeof severity)}
                options={SEVERITY_OPTIONS}
              />
            </div>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Vulnerability Name</label>
            <input className={styles.input} value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className={styles.twoCol}>
            <div className={styles.formGroup}>
              <label className={styles.label}>Author</label>
              <input className={styles.input} value={author} onChange={(e) => setAuthor(e.target.value)} />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label}>Tags (comma separated)</label>
              <input className={styles.input} value={tags} onChange={(e) => setTags(e.target.value)} />
            </div>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Description</label>
            <input
              className={styles.input}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className={styles.twoCol}>
            <div className={styles.formGroup}>
              <label className={styles.label}>HTTP Method</label>
              <CustomSelect
                value={method}
                onChange={setMethod}
                options={METHOD_OPTIONS}
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label}>Status Matcher</label>
              <input
                className={styles.input}
                value={matcherStatus}
                onChange={(e) => setMatcherStatus(e.target.value)}
              />
            </div>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Request Path</label>
            <input className={styles.input} value={path} onChange={(e) => setPath(e.target.value)} />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Match Words (comma separated)</label>
            <input
              className={styles.input}
              value={matcherWords}
              onChange={(e) => setMatcherWords(e.target.value)}
            />
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
