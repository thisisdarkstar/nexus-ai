import { useState, useEffect, useRef } from 'react';
import {
  CheckSquare,
  Filter,
  Sparkles,
  Check,
  X as XIcon,
  HelpCircle,
  RotateCcw,
  Plus,
  Trash2,
  ListPlus,
  Upload,
  Download,
  FileJson,
  FileText,
  AlertCircle,
  CheckCircle2,
  Copy,
} from 'lucide-react';
import ConfirmModal from '../ConfirmModal';
import CustomSelect from '../CustomSelect';
import type { SecurityChecklistItem } from '../../types';
import styles from './ChecklistTracker.module.css';

const SAMPLE_JSON_CHECKLIST = `[
  {
    "code": "AUTH-01",
    "title": "Broken Object-Level Authorization (BOLA/IDOR)",
    "category": "OWASP API Security",
    "description": "Verify that user A cannot access or mutate resources belonging to user B by altering IDs in URLs/payloads.",
    "status": "untested"
  },
  {
    "code": "INJ-02",
    "title": "SQL & NoSQL Injection in Search Parameters",
    "category": "Input Validation",
    "description": "Evaluate input parameters and headers for blind, error-based, and stacked SQLi vectors.",
    "status": "untested"
  },
  {
    "code": "SSRF-03",
    "title": "Server-Side Request Forgery on Webhook Endpoints",
    "category": "Server-Side Flaws",
    "description": "Test webhook and file fetch endpoints against cloud metadata (169.254.169.254) and localhost.",
    "status": "untested"
  }
]`;

const SUITE_OPTIONS = [
  { value: 'core4', label: '🎯 Core 4 Essentials', badge: 'Core' },
  { value: 'wstg_full', label: '🛡️ OWASP WSTG v4.2 (8 Tests)', badge: 'Web' },
  { value: 'api_top10', label: '⚡ OWASP API Top 10 (7 Tests)', badge: 'API' },
];

export const CHECKLIST_SUITES: Record<string, { label: string; items: SecurityChecklistItem[] }> = {
  core4: {
    label: '🎯 Core 4 Essentials',
    items: [
      {
        id: 'wstg-info-01',
        category: 'OWASP WSTG - Reconnaissance',
        code: 'WSTG-INFO-01',
        title: 'Search Engine Discovery & OSINT Reconnaissance',
        description: 'Enumerate sensitive indexed URLs, leaked credentials on GitHub, and cached endpoints.',
        status: 'untested',
      },
      {
        id: 'wstg-authz-02',
        category: 'OWASP WSTG - Authorization',
        code: 'WSTG-AUTHZ-02',
        title: 'Test for Broken Object Level Authorization (BOLA/IDOR)',
        description: 'Verify if changing object IDs (e.g. user_id, order_id) allows unauthorized access to private data.',
        status: 'untested',
      },
      {
        id: 'wstg-inpv-05',
        category: 'OWASP WSTG - Input Validation',
        code: 'WSTG-INPV-05',
        title: 'Test for SQL & NoSQL Injection',
        description: 'Evaluate input parameters, headers, and JSON bodies for blind, error-based, and stacked SQLi.',
        status: 'untested',
      },
      {
        id: 'wstg-inpv-11',
        category: 'OWASP WSTG - Input Validation',
        code: 'WSTG-INPV-11',
        title: 'Test for Server-Side Request Forgery (SSRF)',
        description: 'Evaluate webhook URLs, PDF renderers, and image proxy endpoints for internal IP access.',
        status: 'untested',
      },
    ],
  },
  wstg_full: {
    label: '🛡️ OWASP WSTG v4.2 (Full Suite)',
    items: [
      {
        id: 'wstg-info-01',
        category: 'OWASP WSTG - Reconnaissance',
        code: 'WSTG-INFO-01',
        title: 'Search Engine Discovery & OSINT Reconnaissance',
        description: 'Enumerate sensitive indexed URLs, leaked credentials on GitHub, and cached endpoints.',
        status: 'untested',
      },
      {
        id: 'wstg-info-02',
        category: 'OWASP WSTG - Reconnaissance',
        code: 'WSTG-INFO-02',
        title: 'Fingerprint Web Server & Backend Tech Stack',
        description: 'Inspect HTTP response headers, error stack traces, and framework cookie signatures.',
        status: 'untested',
      },
      {
        id: 'wstg-authz-02',
        category: 'OWASP WSTG - Authorization',
        code: 'WSTG-AUTHZ-02',
        title: 'Test for Broken Object Level Authorization (BOLA/IDOR)',
        description: 'Verify if changing object IDs (e.g. user_id, order_id) allows unauthorized access to private data.',
        status: 'untested',
      },
      {
        id: 'wstg-inpv-05',
        category: 'OWASP WSTG - Input Validation',
        code: 'WSTG-INPV-05',
        title: 'Test for SQL & NoSQL Injection',
        description: 'Evaluate input parameters, headers, and JSON bodies for blind, error-based, and stacked SQLi.',
        status: 'untested',
      },
      {
        id: 'wstg-inpv-07',
        category: 'OWASP WSTG - Input Validation',
        code: 'WSTG-INPV-07',
        title: 'Test for Cross-Site Scripting (XSS)',
        description: 'Verify contextual output encoding across reflected parameters, stored data, and DOM sinks.',
        status: 'untested',
      },
      {
        id: 'wstg-inpv-11',
        category: 'OWASP WSTG - Input Validation',
        code: 'WSTG-INPV-11',
        title: 'Test for Server-Side Request Forgery (SSRF)',
        description: 'Evaluate webhook URLs, PDF renderers, and image proxy endpoints for internal IP access.',
        status: 'untested',
      },
      {
        id: 'wstg-conf-04',
        category: 'OWASP WSTG - Configuration',
        code: 'WSTG-CONF-04',
        title: 'Review Old, Backup and Unreferenced Files',
        description: 'Check for .bak, .git, .env, and swagger documentation leaks on public paths.',
        status: 'untested',
      },
      {
        id: 'wstg-cryp-03',
        category: 'OWASP WSTG - Cryptography',
        code: 'WSTG-CRYP-03',
        title: 'Test for Weak SSL/TLS Ciphers & HSTS',
        description: 'Audit transport layer encryption, obsolete TLS 1.0/1.1 protocols, and missing HSTS.',
        status: 'untested',
      },
    ],
  },
  api_top10: {
    label: '⚡ OWASP API Security Top 10 (2023)',
    items: [
      {
        id: 'api-1-2023',
        category: 'OWASP API Security Top 10',
        code: 'API1:2023',
        title: 'Broken Object Level Authorization (BOLA)',
        description: 'Test all REST & GraphQL query endpoints with horizontal authorization matrix.',
        status: 'untested',
      },
      {
        id: 'api-2-2023',
        category: 'OWASP API Security Top 10',
        code: 'API2:2023',
        title: 'Broken Authentication & Token Expiration',
        description: 'Inspect JWT signature verification, secret strength, and token expiration handling.',
        status: 'untested',
      },
      {
        id: 'api-3-2023',
        category: 'OWASP API Security Top 10',
        code: 'API3:2023',
        title: 'Broken Object Property Level Authorization',
        description: 'Check mass assignment and sensitive property exposure in response bodies.',
        status: 'untested',
      },
      {
        id: 'api-4-2023',
        category: 'OWASP API Security Top 10',
        code: 'API4:2023',
        title: 'Unrestricted Resource Consumption & Rate Limiting',
        description: 'Evaluate API endpoints for brute force, high-cost GraphQL queries, and payload limits.',
        status: 'untested',
      },
      {
        id: 'api-5-2023',
        category: 'OWASP API Security Top 10',
        code: 'API5:2023',
        title: 'Broken Function Level Authorization (BFLA)',
        description: 'Verify if administrative API functions can be invoked by regular authenticated users.',
        status: 'untested',
      },
      {
        id: 'api-7-2023',
        category: 'OWASP API Security Top 10',
        code: 'API7:2023',
        title: 'Security Misconfiguration (CORS, Debug Endpoints)',
        description: 'Audit CORS headers (Access-Control-Allow-Origin: * with credentials) and exposed swagger.json.',
        status: 'untested',
      },
      {
        id: 'api-8-2023',
        category: 'OWASP API Security Top 10',
        code: 'API8:2023',
        title: 'Server Side Request Forgery (SSRF) in API Webhooks',
        description: 'Inspect custom webhook callbacks and remote file fetching endpoints for internal SSRF.',
        status: 'untested',
      },
    ],
  },
};

const DEFAULT_CHECKLIST = CHECKLIST_SUITES.core4.items;
const CHECKLIST_STORAGE_KEY = 'nexus_security_checklists';
const CUSTOM_SUITES_STORAGE_KEY = 'nexus_custom_checklist_suites';

interface ChecklistTrackerProps {
  onSendToAI?: (prompt: string) => void;
}

export default function ChecklistTracker({ onSendToAI }: ChecklistTrackerProps) {
  const [items, setItems] = useState<SecurityChecklistItem[]>(() => {
    try {
      const saved = localStorage.getItem(CHECKLIST_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Failed to load checklist from localStorage:', e);
    }
    return DEFAULT_CHECKLIST;
  });

  // User-created Custom Checklist Suites
  const [customSuites, setCustomSuites] = useState<Record<string, { label: string; items: SecurityChecklistItem[] }>>(() => {
    try {
      const saved = localStorage.getItem(CUSTOM_SUITES_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed === 'object' && parsed !== null) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Failed to load custom suites from localStorage:', e);
    }
    return {};
  });

  const [filter, setFilter] = useState<'all' | 'untested' | 'pass' | 'fail'>('all');
  const [newTitle, setNewTitle] = useState('');
  const [newCode, setNewCode] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  // JSON Import / Export Modal State
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [jsonInput, setJsonInput] = useState('');
  const [importMode, setImportMode] = useState<'replace' | 'append' | 'new_suite'>('replace');
  const [newSuiteName, setNewSuiteName] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [parsedCount, setParsedCount] = useState<number | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    variant?: 'danger' | 'primary' | 'warning' | 'info';
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  useEffect(() => {
    try {
      localStorage.setItem(CHECKLIST_STORAGE_KEY, JSON.stringify(items));
    } catch (e) {
      console.error('Failed to save checklist to localStorage:', e);
    }
  }, [items]);

  useEffect(() => {
    try {
      localStorage.setItem(CUSTOM_SUITES_STORAGE_KEY, JSON.stringify(customSuites));
    } catch (e) {
      console.error('Failed to save custom suites to localStorage:', e);
    }
  }, [customSuites]);

  const handleStatusChange = (id: string, newStatus: SecurityChecklistItem['status']) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, status: newStatus } : it)));
  };

  const handleLoadSuite = (suiteKey: string) => {
    const allSuites = { ...CHECKLIST_SUITES, ...customSuites };
    const suite = allSuites[suiteKey];
    if (!suite) return;
    setModalConfig({
      isOpen: true,
      title: 'Load Methodology Suite',
      message: `Load "${suite.label}" checklist? This will update your active items to this testing standard.`,
      confirmLabel: 'Load Suite',
      variant: 'primary',
      onConfirm: () => {
        setItems(suite.items);
        setModalConfig((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  const handleResetChecklist = () => {
    setModalConfig({
      isOpen: true,
      title: 'Reset Checklist Progress',
      message: 'Are you sure you want to reset all checklist items back to Untested status (0% progress)?',
      confirmLabel: 'Reset All',
      variant: 'warning',
      onConfirm: () => {
        setItems((prev) => prev.map((item) => ({ ...item, status: 'untested' })));
        setModalConfig((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    const item: SecurityChecklistItem = {
      id: `custom-${Date.now()}`,
      category: 'Custom Verification',
      code: newCode.trim() || `TEST-${items.length + 1}`,
      title: newTitle.trim(),
      description: 'Custom security test item defined for this engagement.',
      status: 'untested',
    };
    setItems((prev) => [item, ...prev]);
    setNewTitle('');
    setNewCode('');
    setShowAddForm(false);
  };

  const handleDeleteItem = (id: string, code: string) => {
    setModalConfig({
      isOpen: true,
      title: 'Delete Checklist Item',
      message: `Are you sure you want to remove item [${code}] from this engagement?`,
      confirmLabel: 'Delete Item',
      variant: 'danger',
      onConfirm: () => {
        setItems((prev) => prev.filter((it) => it.id !== id));
        setModalConfig((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  // Safe JSON Checklist Parser & Validator
  const parseChecklistJson = (raw: string): { valid: boolean; items: SecurityChecklistItem[]; error?: string } => {
    if (!raw.trim()) {
      return { valid: false, items: [], error: 'Please paste or upload JSON checklist data.' };
    }
    try {
      const parsed = JSON.parse(raw);
      const rawArray = Array.isArray(parsed)
        ? parsed
        : Array.isArray((parsed as Record<string, unknown>).items)
        ? ((parsed as Record<string, unknown>).items as unknown[])
        : Array.isArray((parsed as Record<string, unknown>).checklist)
        ? ((parsed as Record<string, unknown>).checklist as unknown[])
        : null;

      if (!rawArray) {
        return {
          valid: false,
          items: [],
          error: 'JSON must be an array of checklist objects, e.g. [ { "code": "...", "title": "..." } ]',
        };
      }

      if (rawArray.length === 0) {
        return { valid: false, items: [], error: 'Checklist array is empty.' };
      }

      const sanitizedItems: SecurityChecklistItem[] = rawArray.map((rawItem: unknown, idx: number) => {
        if (typeof rawItem !== 'object' || rawItem === null) {
          throw new Error(`Item #${idx + 1} is not a valid JSON object.`);
        }
        const it = rawItem as Record<string, unknown>;
        const title = String(it.title || it.name || '').trim();
        if (!title) {
          throw new Error(`Item #${idx + 1} is missing a required "title" property.`);
        }
        const code = String(it.code || it.id || `TEST-${idx + 1}`).trim();
        const category = String(it.category || it.group || 'Custom Verification').trim();
        const description = String(it.description || it.desc || 'Custom checklist security test.').trim();
        const statusRaw = String(it.status || 'untested').toLowerCase();
        const status: SecurityChecklistItem['status'] =
          statusRaw === 'pass' || statusRaw === 'passed'
            ? 'pass'
            : statusRaw === 'fail' || statusRaw === 'failed'
            ? 'fail'
            : 'untested';

        return {
          id: typeof it.id === 'string' && it.id.length > 3 ? it.id : `chk-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
          category,
          code,
          title,
          description,
          status,
        };
      });

      return { valid: true, items: sanitizedItems };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invalid JSON syntax.';
      return { valid: false, items: [], error: msg };
    }
  };

  const handleJsonInputChange = (val: string) => {
    setJsonInput(val);
    if (!val.trim()) {
      setImportError(null);
      setParsedCount(null);
      return;
    }
    const res = parseChecklistJson(val);
    if (res.valid) {
      setImportError(null);
      setParsedCount(res.items.length);
    } else {
      setImportError(res.error || 'Invalid JSON format');
      setParsedCount(null);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadedFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setJsonInput(content);
        const res = parseChecklistJson(content);
        if (res.valid) {
          setImportError(null);
          setParsedCount(res.items.length);
        } else {
          setImportError(res.error || 'Failed to parse uploaded JSON file.');
          setParsedCount(null);
        }
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleInsertSampleTemplate = () => {
    setJsonInput(SAMPLE_JSON_CHECKLIST);
    const res = parseChecklistJson(SAMPLE_JSON_CHECKLIST);
    if (res.valid) {
      setImportError(null);
      setParsedCount(res.items.length);
    }
    setUploadedFileName(null);
  };

  const handleExecuteImport = () => {
    const res = parseChecklistJson(jsonInput);
    if (!res.valid) {
      setImportError(res.error || 'Cannot import invalid JSON checklist.');
      return;
    }
    if (importMode === 'replace') {
      setItems(res.items);
    } else if (importMode === 'append') {
      setItems((prev) => [...prev, ...res.items]);
    } else if (importMode === 'new_suite') {
      const suiteTitle =
        newSuiteName.trim() ||
        (uploadedFileName ? uploadedFileName.replace(/\.json$/i, '') : `Custom Suite ${Object.keys(customSuites).length + 1}`);
      const suiteId = `custom_suite_${Date.now()}`;
      setCustomSuites((prev) => ({
        ...prev,
        [suiteId]: {
          label: suiteTitle,
          items: res.items,
        },
      }));
      setItems(res.items);
    }
    setIsImportOpen(false);
    setJsonInput('');
    setNewSuiteName('');
    setImportError(null);
    setParsedCount(null);
    setUploadedFileName(null);
  };

  const handleExportJson = () => {
    const dataStr = JSON.stringify(items, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nexus_checklist_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const total = items.length;
  const testedCount = items.filter((i) => i.status !== 'untested').length;
  const failCount = items.filter((i) => i.status === 'fail').length;
  const progressPercent = total > 0 ? Math.round((testedCount / total) * 100) : 0;

  const filteredItems = items.filter((i) => {
    if (filter === 'all') return true;
    return i.status === filter;
  });

  const dynamicSuiteOptions = [
    ...SUITE_OPTIONS,
    ...Object.entries(customSuites).map(([key, s]) => ({
      value: key,
      label: `📋 ${s.label} (${s.items.length} Tests)`,
      badge: 'Custom',
    })),
  ];

  return (
    <div className={styles.checklistContainer}>
      {/* Header */}
      <div className={styles.topBar}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <CheckSquare size={16} color="var(--accent-color)" />
          <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>
            VAPT Methodology & Checklist Tracker
          </span>
          <span style={{ fontSize: '0.75rem', color: '#10b981' }}>
            {progressPercent}% Complete ({testedCount}/{total})
          </span>
          {failCount > 0 && (
            <span style={{ fontSize: '0.75rem', color: '#ef4444' }}>
              ({failCount} Vulnerabilities Found)
            </span>
          )}
        </div>

        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
          {/* Suite Loader Selector */}
          <CustomSelect
            value=""
            placeholder="📂 Load Standard Suite..."
            options={dynamicSuiteOptions}
            onChange={(val) => handleLoadSuite(val)}
            style={{ minWidth: '190px' }}
          />

          <button
            className={styles.btn}
            onClick={() => setShowAddForm(!showAddForm)}
            title="Add Single Custom Item"
          >
            <Plus size={12} /> Add Item
          </button>

          <button
            className={styles.btn}
            onClick={() => {
              setJsonInput('');
              setImportError(null);
              setParsedCount(null);
              setUploadedFileName(null);
              setIsImportOpen(true);
            }}
            title="Upload or paste custom JSON checklist"
          >
            <Upload size={12} /> Import JSON
          </button>

          <button
            className={styles.btn}
            onClick={handleExportJson}
            title="Export active checklist to JSON file"
          >
            <Download size={12} /> Export JSON
          </button>

          <button
            className={styles.btn}
            onClick={handleResetChecklist}
            title="Reset all test statuses to Untested (0%)"
          >
            <RotateCcw size={12} /> Reset
          </button>

          {onSendToAI && (
            <button
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.35rem 0.7rem',
                borderRadius: '6px',
                fontSize: '0.75rem',
                fontWeight: 600,
                background: 'linear-gradient(135deg, #059669, #10b981)',
                border: 'none',
                color: 'white',
                cursor: 'pointer',
              }}
              onClick={() => {
                const fails = items.filter((i) => i.status === 'fail');
                if (fails.length === 0) {
                  onSendToAI('I am using the VAPT Checklist Tracker. Recommend prioritized test categories for my current web assessment.');
                } else {
                  const summary = fails.map((f) => `- [FAIL] ${f.code}: ${f.title}`).join('\n');
                  onSendToAI(
                    `We have identified the following failed security controls during testing:\n\n${summary}\n\nDraft a prioritized vulnerability remediation and exploit escalation guide for these issues.`
                  );
                }
              }}
            >
              <Sparkles size={13} /> AI Remediation Plan
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar Strip */}
      <div className={styles.progressStrip}>
        <div
          className={styles.progressFill}
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Add Custom Item Strip */}
      {showAddForm && (
        <form
          onSubmit={handleAddItem}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            background: 'rgba(0,0,0,0.35)',
            border: '1px solid rgba(16,185,129,0.3)',
            borderRadius: '8px',
            padding: '0.5rem 0.7rem',
            flexWrap: 'wrap',
          }}
        >
          <input
            type="text"
            placeholder="Code (e.g. WSTG-CONF-05)"
            value={newCode}
            onChange={(e) => setNewCode(e.target.value)}
            style={{
              width: '140px',
              background: '#0f172a',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '6px',
              color: '#38bdf8',
              padding: '0.35rem 0.5rem',
              fontSize: '0.76rem',
              fontFamily: 'monospace',
            }}
          />
          <input
            type="text"
            placeholder="Checklist Item Title / Vulnerability Test..."
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            style={{
              flex: 1,
              minWidth: '220px',
              background: '#0f172a',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '6px',
              color: '#f8fafc',
              padding: '0.35rem 0.5rem',
              fontSize: '0.78rem',
            }}
          />
          <button
            type="submit"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.3rem',
              padding: '0.35rem 0.75rem',
              borderRadius: '6px',
              fontSize: '0.75rem',
              fontWeight: 600,
              background: '#10b981',
              color: 'white',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            <ListPlus size={12} /> Add
          </button>
        </form>
      )}

      {/* Filter Tabs */}
      <div className={styles.filterRow}>
        <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
          <Filter size={13} color="var(--text-secondary)" />
          <button
            className={`${styles.filterBtn} ${filter === 'all' ? styles.activeFilter : ''}`}
            onClick={() => setFilter('all')}
          >
            All ({total})
          </button>
          <button
            className={`${styles.filterBtn} ${filter === 'untested' ? styles.activeFilter : ''}`}
            onClick={() => setFilter('untested')}
          >
            Untested ({items.filter((i) => i.status === 'untested').length})
          </button>
          <button
            className={`${styles.filterBtn} ${filter === 'pass' ? styles.activeFilter : ''}`}
            onClick={() => setFilter('pass')}
          >
            Passed ({items.filter((i) => i.status === 'pass').length})
          </button>
          <button
            className={`${styles.filterBtn} ${filter === 'fail' ? styles.activeFilter : ''}`}
            onClick={() => setFilter('fail')}
          >
            Failed ({failCount})
          </button>
        </div>
      </div>

      {/* Checklist Cards Grid */}
      <div className={styles.checkGrid}>
        {filteredItems.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
            No checklist items match the current filter.
          </div>
        ) : (
          filteredItems.map((item) => {
            const isPass = item.status === 'pass';
            const isFail = item.status === 'fail';
            return (
              <div
                key={item.id}
                className={`${styles.checkCard} ${isPass ? styles.cardPass : isFail ? styles.cardFail : ''}`}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.2rem' }}>
                      <span className={styles.codeBadge}>{item.code}</span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{item.category}</span>
                    </div>
                    <div style={{ fontWeight: 600, fontSize: '0.84rem', color: 'var(--text-primary)' }}>{item.title}</div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <div className={styles.statusGroup}>
                      <button
                        className={`${styles.statusBtn} ${isPass ? styles.passActive : ''}`}
                        onClick={() => handleStatusChange(item.id, isPass ? 'untested' : 'pass')}
                        title="Mark Passed / Secure"
                      >
                        <Check size={11} /> Pass
                      </button>
                      <button
                        className={`${styles.statusBtn} ${isFail ? styles.failActive : ''}`}
                        onClick={() => handleStatusChange(item.id, isFail ? 'untested' : 'fail')}
                        title="Mark Failed / Vulnerability Found"
                      >
                        <XIcon size={11} /> Fail
                      </button>
                      <button
                        className={`${styles.statusBtn} ${item.status === 'untested' ? styles.untestedActive : ''}`}
                        onClick={() => handleStatusChange(item.id, 'untested')}
                        title="Mark Untested"
                      >
                        <HelpCircle size={11} /> Reset
                      </button>
                    </div>

                    <button
                      onClick={() => handleDeleteItem(item.id, item.code)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#64748b',
                        cursor: 'pointer',
                        padding: '0.2rem',
                        display: 'inline-flex',
                        alignItems: 'center',
                      }}
                      title="Delete checklist item"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>

                <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: '0.25rem', lineHeight: 1.4 }}>
                  {item.description}
                </div>
              </div>
            );
          })
        )}
      </div>

      {modalConfig.isOpen && (
        <ConfirmModal
          title={modalConfig.title}
          message={modalConfig.message}
          confirmLabel={modalConfig.confirmLabel}
          variant={modalConfig.variant}
          onConfirm={modalConfig.onConfirm}
          onCancel={() => setModalConfig((prev) => ({ ...prev, isOpen: false }))}
        />
      )}

      {/* JSON Import & Upload Modal */}
      {isImportOpen && (
        <div className={styles.modalOverlay} onClick={() => setIsImportOpen(false)}>
          <div
            className={styles.modalContainer}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            {/* Modal Header */}
            <div className={styles.modalHeader}>
              <div className={styles.modalTitleGroup}>
                <div className={styles.modalIconCircle}>
                  <FileJson size={18} />
                </div>
                <div>
                  <div className={styles.modalTitle}>Import Custom Checklist (JSON)</div>
                  <div className={styles.modalSubtitle}>
                    Upload a .json checklist file or paste your custom JSON payload.
                  </div>
                </div>
              </div>
              <button
                className={styles.modalCloseBtn}
                onClick={() => setIsImportOpen(false)}
                title="Close dialog"
              >
                <XIcon size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className={styles.modalBody}>
              {/* Toolbar Actions */}
              <div className={styles.modalToolbar}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept=".json,application/json"
                    onChange={handleFileUpload}
                    style={{ display: 'none' }}
                  />
                  <button
                    className={styles.btn}
                    onClick={() => fileInputRef.current?.click()}
                    title="Choose a JSON file from disk"
                  >
                    <Upload size={12} /> {uploadedFileName ? `📁 ${uploadedFileName}` : 'Choose File...'}
                  </button>

                  <button
                    className={styles.btn}
                    onClick={handleInsertSampleTemplate}
                    title="Insert valid sample checklist JSON into editor"
                  >
                    <FileText size={12} /> Insert Sample Template
                  </button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  {jsonInput && (
                    <button
                      className={styles.btn}
                      onClick={() => {
                        navigator.clipboard.writeText(jsonInput);
                        setCopyFeedback(true);
                        setTimeout(() => setCopyFeedback(false), 2000);
                      }}
                      title="Copy JSON contents"
                    >
                      <Copy size={12} /> {copyFeedback ? 'Copied!' : 'Copy'}
                    </button>
                  )}
                  {jsonInput && (
                    <button
                      className={styles.btn}
                      onClick={() => {
                        setJsonInput('');
                        setImportError(null);
                        setParsedCount(null);
                        setUploadedFileName(null);
                      }}
                      title="Clear textarea"
                    >
                      <Trash2 size={12} /> Clear
                    </button>
                  )}
                </div>
              </div>

              {/* JSON Textarea with Valid Placeholder */}
              <div className={styles.jsonEditorWrapper}>
                <textarea
                  className={styles.jsonTextarea}
                  placeholder={`// Paste your JSON checklist array here. Example format:\n${SAMPLE_JSON_CHECKLIST}`}
                  value={jsonInput}
                  onChange={(e) => handleJsonInputChange(e.target.value)}
                  spellCheck={false}
                />
              </div>

              {/* Import Mode Options */}
              <div className={styles.modeOptionRow} style={{ flexWrap: 'wrap', gap: '0.85rem' }}>
                <span style={{ fontWeight: 600, color: '#94a3b8' }}>Import Mode:</span>
                <label className={styles.radioLabel}>
                  <input
                    type="radio"
                    name="importMode"
                    value="replace"
                    checked={importMode === 'replace'}
                    onChange={() => setImportMode('replace')}
                  />
                  Replace Current Checklist ({items.length} items)
                </label>
                <label className={styles.radioLabel}>
                  <input
                    type="radio"
                    name="importMode"
                    value="append"
                    checked={importMode === 'append'}
                    onChange={() => setImportMode('append')}
                  />
                  Append to Current
                </label>
                <label className={styles.radioLabel}>
                  <input
                    type="radio"
                    name="importMode"
                    value="new_suite"
                    checked={importMode === 'new_suite'}
                    onChange={() => setImportMode('new_suite')}
                  />
                  ✨ Save as New Suite / Checklist
                </label>
              </div>

              {/* Suite Name Input when in new_suite mode */}
              {importMode === 'new_suite' && (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.35rem',
                    background: 'rgba(16, 185, 129, 0.08)',
                    border: '1px solid rgba(16, 185, 129, 0.25)',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '8px',
                  }}
                >
                  <label style={{ fontSize: '0.76rem', fontWeight: 600, color: '#34d399' }}>
                    Custom Suite / Checklist Name:
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Cloud Pentest Suite, PCI-DSS Assessment, Custom API Checks..."
                    value={newSuiteName}
                    onChange={(e) => setNewSuiteName(e.target.value)}
                    style={{
                      background: '#020617',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      borderRadius: '6px',
                      color: '#f8fafc',
                      padding: '0.45rem 0.65rem',
                      fontSize: '0.8rem',
                      outline: 'none',
                    }}
                  />
                  <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                    💡 This checklist will be saved permanently and appear in your <strong>"📂 Load Standard Suite..."</strong> dropdown alongside the predefined ones.
                  </span>
                </div>
              )}

              {/* Status / Error feedback */}
              {importError && (
                <div className={styles.errorBanner}>
                  <AlertCircle size={15} style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <strong>Validation Error:</strong> {importError}
                  </div>
                </div>
              )}

              {!importError && parsedCount !== null && parsedCount > 0 && (
                <div className={styles.successBanner}>
                  <CheckCircle2 size={15} style={{ flexShrink: 0 }} />
                  <span>
                    Valid checklist schema: ready to import <strong>{parsedCount} test items</strong>.
                  </span>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className={styles.modalFooter}>
              <button className={styles.btn} onClick={() => setIsImportOpen(false)}>
                Cancel
              </button>
              <button
                className={`${styles.btn} ${styles.btnPrimary}`}
                disabled={!parsedCount || parsedCount === 0 || !!importError}
                onClick={handleExecuteImport}
                style={{
                  opacity: !parsedCount || parsedCount === 0 || !!importError ? 0.5 : 1,
                  cursor: !parsedCount || parsedCount === 0 || !!importError ? 'not-allowed' : 'pointer',
                }}
              >
                <Upload size={13} /> {parsedCount ? `Import ${parsedCount} Items` : 'Import Checklist'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
