import { useState, useEffect } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  RotateCcw,
  Check,
  Copy,
  GitPullRequest,
  FileCode,
  Zap,
  ArrowRight,
} from 'lucide-react';
import CustomSelect from '../common/CustomSelect';
import { projectLocalStorage } from '../../core/storage/projectStorage';
import { scanSourceCode } from '../../lib/security/sastScanner';
import { workbenchBridge } from '../../lib/security/workbenchBridge';
import type { VulnerabilityFinding } from '../../types';
import styles from './CodeAuditor.module.css';

const LANGUAGE_OPTIONS = [
  { value: 'python', label: 'Python' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'go', label: 'Go' },
  { value: 'java', label: 'Java' },
  { value: 'c', label: 'C / C++' },
  { value: 'php', label: 'PHP' },
  { value: 'solidity', label: 'Solidity' },
];

interface CodeAuditorProps {
  initialCode?: string;
  onSendToAI?: (prompt: string) => void;
}

const SAMPLE_VULNERABILITIES = [
  {
    id: 'sqli',
    name: 'SQL Injection (CWE-89)',
    language: 'python',
    code: `import sqlite3

def get_user_profile(user_input):
    conn = sqlite3.connect('users.db')
    cursor = conn.cursor()
    # VULNERABLE: Direct string formatting into SQL query allows SQL Injection (CWE-89)
    query = f"SELECT * FROM users WHERE username = '{user_input}'"
    cursor.execute(query)
    return cursor.fetchall()
`,
    finding: {
      id: 'f-sqli',
      title: 'SQL Injection via Unsanitized Input Concatenation',
      severity: 'critical' as const,
      cweId: 'CWE-89',
      owaspCategory: 'A03:2021-Injection',
      file: 'app/controllers/user.py',
      lineStart: 7,
      lineEnd: 8,
      description:
        'User-controlled string "user_input" is directly formatted into an active SQL query, allowing attackers to execute arbitrary database commands or bypass authentication.',
      remediation:
        'Use parameterized queries (prepared statements) with placeholders to separate SQL syntax from untrusted parameters.',
      patchDiff: {
        original: '    query = f"SELECT * FROM users WHERE username = \'{user_input}\'"\n    cursor.execute(query)',
        patched: '    query = "SELECT * FROM users WHERE username = ?"\n    cursor.execute(query, (user_input,))',
      },
    },
  },
  {
    id: 'cmdi',
    name: 'Command Injection (CWE-78)',
    language: 'python',
    code: `import subprocess

def ping_host(host_ip):
    # VULNERABLE: shell=True with unvalidated user input enables OS Command Injection
    cmd = f"ping -c 1 {host_ip}"
    result = subprocess.check_output(cmd, shell=True)
    return result
`,
    finding: {
      id: 'f-cmdi',
      title: 'OS Command Injection in Ping Utility',
      severity: 'critical' as const,
      cweId: 'CWE-78',
      owaspCategory: 'A03:2021-Injection',
      file: 'utils/network.py',
      lineStart: 5,
      lineEnd: 6,
      description:
        'Passing unsanitized shell commands with `shell=True` permits shell metacharacters (e.g. `;`, `|`, `&&`) to execute arbitrary host commands.',
      remediation:
        'Avoid `shell=True` and pass arguments as an immutable list or validate input strictly against an IPv4/IPv6 regex.',
      patchDiff: {
        original: '    cmd = f"ping -c 1 {host_ip}"\n    result = subprocess.check_output(cmd, shell=True)',
        patched: '    import ipaddress\n    ipaddress.ip_address(host_ip) # Validate IP\n    result = subprocess.check_output(["ping", "-c", "1", host_ip])',
      },
    },
  },
  {
    id: 'ssrf',
    name: 'Server-Side Request Forgery (CWE-918)',
    language: 'javascript',
    code: `const express = require('express');
const axios = require('axios');
const app = express();

app.get('/fetch-url', async (req, res) => {
    const { targetUrl } = req.query;
    // VULNERABLE: Fetching unvalidated user-supplied URLs enables SSRF into internal networks (e.g. 169.254.169.254)
    const response = await axios.get(targetUrl);
    res.send(response.data);
});
`,
    finding: {
      id: 'f-ssrf',
      title: 'Server-Side Request Forgery (SSRF) via Dynamic Proxy Endpoint',
      severity: 'high' as const,
      cweId: 'CWE-918',
      owaspCategory: 'A10:2021-Server-Side Request Forgery',
      file: 'server/routes.js',
      lineStart: 7,
      lineEnd: 8,
      description:
        'The endpoint blindly executes HTTP requests to any user-supplied URI without verifying whether the destination resolves to private RFC1918 IPs or cloud metadata services.',
      remediation:
        'Validate destination against an explicit allowlist of domain names, and resolve DNS to block loopback (127.0.0.1) and private IP ranges before sending requests.',
      patchDiff: {
        original: '    const response = await axios.get(targetUrl);',
        patched: '    const parsed = new URL(targetUrl);\n    if (!ALLOWED_DOMAINS.includes(parsed.hostname)) return res.status(403).send("Forbidden");\n    const response = await axios.get(targetUrl, { timeout: 3000 });',
      },
    },
  },
];

const CODE_AUDITOR_STORAGE_KEY = 'nexus_security_code_auditor_v1';

interface SavedCodeAuditorState {
  code?: string;
  language?: string;
  selectedSample?: string;
  findings?: VulnerabilityFinding[];
}

function loadSavedCodeAuditor(): SavedCodeAuditorState {
  try {
    const raw = projectLocalStorage.getItem(CODE_AUDITOR_STORAGE_KEY);
    if (raw) return JSON.parse(raw) as SavedCodeAuditorState;
  } catch {
    // ignore storage parse failure
  }
  return {};
}

export default function CodeAuditor({
  initialCode,
  onSendToAI,
}: CodeAuditorProps) {
  const [savedState] = useState<SavedCodeAuditorState>(() => loadSavedCodeAuditor());
  const [code, setCode] = useState(
    initialCode || savedState.code || SAMPLE_VULNERABILITIES[0].code
  );
  const [language, setLanguage] = useState(savedState.language || 'python');
  const [selectedSample, setSelectedSample] = useState(
    savedState.selectedSample || SAMPLE_VULNERABILITIES[0].id
  );
  const [findings, setFindings] = useState<VulnerabilityFinding[]>(
    Array.isArray(savedState.findings) ? savedState.findings : [SAMPLE_VULNERABILITIES[0].finding]
  );
  const [copiedPatchId, setCopiedPatchId] = useState<string | null>(null);
  const [exportedFindingId, setExportedFindingId] = useState<string | null>(null);

  useEffect(() => {
    try {
      projectLocalStorage.setItem(
        CODE_AUDITOR_STORAGE_KEY,
        JSON.stringify({ code, language, selectedSample, findings })
      );
    } catch {
      // ignore storage quota errors
    }
  }, [code, language, selectedSample, findings]);

  useEffect(() => {
    if (initialCode) {
      setCode(initialCode);
      const localFindings = scanSourceCode(initialCode, language);
      if (localFindings.length > 0) {
        setFindings(localFindings);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCode]);

  const handleSelectSample = (sampleId: string) => {
    setSelectedSample(sampleId);
    const sample = SAMPLE_VULNERABILITIES.find((s) => s.id === sampleId);
    if (sample) {
      setCode(sample.code);
      setLanguage(sample.language);
      setFindings([sample.finding]);
    }
  };

  const handleLocalScan = () => {
    const scanned = scanSourceCode(code, language);
    setFindings(scanned);
  };

  const handleAuditRequest = () => {
    if (!onSendToAI || !code.trim()) return;
    const prompt = `Perform a rigorous Static Application Security Testing (SAST) audit on the following ${language} code:\n\n\`\`\`${language}\n${code}\n\`\`\`\n\nPlease structure your response with:\n1. Vulnerability Title & Severity (Critical/High/Medium/Low)\n2. CWE ID & OWASP Top 10 Category\n3. Impact & Exploit Scenario\n4. Recommended Secure Remediation (Drop-in Before/After Diff)`;
    onSendToAI(prompt);
  };

  const copyPatch = (finding: VulnerabilityFinding) => {
    if (!finding.patchDiff) return;
    navigator.clipboard.writeText(finding.patchDiff.patched);
    setCopiedPatchId(finding.id);
    setTimeout(() => setCopiedPatchId(null), 2000);
  };

  const applyPatch = (finding: VulnerabilityFinding) => {
    if (!finding.patchDiff) return;
    setCode((prev) => prev.replace(finding.patchDiff!.original, finding.patchDiff!.patched));
  };

  const exportFindingToReport = (finding: VulnerabilityFinding) => {
    workbenchBridge.addFinding(finding);
    setExportedFindingId(finding.id);
    setTimeout(() => setExportedFindingId(null), 2500);
  };

  return (
    <div className={styles.auditorContainer}>
      {/* Top Controls */}
      <div className={styles.topBar}>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <CustomSelect
            value={selectedSample}
            onChange={handleSelectSample}
            options={SAMPLE_VULNERABILITIES.map((s) => ({ value: s.id, label: s.name }))}
            style={{ minWidth: '240px' }}
          />
          <CustomSelect
            value={language}
            onChange={setLanguage}
            options={LANGUAGE_OPTIONS}
            style={{ minWidth: '130px' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            className={`${styles.btn}`}
            onClick={handleLocalScan}
            title="Scan code using client-side AST and OWASP pattern engine"
          >
            <Zap size={14} color="#f59e0b" /> Fast Scan
          </button>
          <button
            className={`${styles.btn} ${styles.btnPrimary}`}
            onClick={handleAuditRequest}
          >
            <Sparkles size={14} /> Audit with AI
          </button>
        </div>
      </div>

      {/* Target Code Editor Area */}
      <div className={styles.editorCard}>
        <div className={styles.cardHeader}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <FileCode size={14} /> Target Source Code
          </span>
          <button
            className={styles.btn}
            style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }}
            onClick={() => {
              setCode('');
              setFindings([]);
            }}
          >
            <RotateCcw size={11} /> Clear
          </button>
        </div>
        <textarea
          className={styles.codeArea}
          value={code}
          onChange={(e) => {
            const newCode = e.target.value;
            setCode(newCode);
            const liveFindings = scanSourceCode(newCode, language);
            if (liveFindings.length > 0) {
              setFindings(liveFindings);
            }
          }}
          placeholder="// Paste source code to inspect for vulnerabilities and logic flaws..."
          spellCheck={false}
        />
      </div>

      {/* Vulnerability Findings & Diffs */}
      <div className={styles.findingsList}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            Detected Vulnerabilities & Remediation Diffs ({findings.length})
          </span>
        </div>

        {findings.map((finding) => (
          <div
            key={finding.id}
            className={`${styles.findingCard} ${styles[finding.severity]}`}
          >
            <div className={styles.findingHeader}>
              <span className={styles.findingTitle}>
                <ShieldAlert size={16} /> {finding.title}
              </span>
              <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                {finding.lineStart && (
                  <span className={styles.badge} style={{ opacity: 0.8 }}>
                    Line {finding.lineStart}
                  </span>
                )}
                {finding.cweId && (
                  <span className={`${styles.badge} ${styles[finding.severity]}`}>
                    {finding.cweId}
                  </span>
                )}
                <span className={`${styles.badge} ${styles[finding.severity]}`}>
                  {finding.severity}
                </span>
              </div>
            </div>

            <p className={styles.findingDesc}>{finding.description}</p>
            <p className={styles.findingDesc} style={{ color: '#a7f3d0' }}>
              <strong>Remediation:</strong> {finding.remediation}
            </p>

            {finding.patchDiff && (
              <div className={styles.diffContainer}>
                <div className={`${styles.diffBlock} ${styles.diffOriginal}`}>
                  <div style={{ fontWeight: 600, marginBottom: '0.2rem', color: '#f87171' }}>
                    Insecure (Original)
                  </div>
                  {finding.patchDiff.original}
                </div>
                <div className={`${styles.diffBlock} ${styles.diffPatched}`}>
                  <div style={{ fontWeight: 600, marginBottom: '0.2rem', color: '#34d399' }}>
                    Remediated (Secure)
                  </div>
                  {finding.patchDiff.patched}
                </div>
              </div>
            )}

            <div className={styles.actionRow} style={{ marginTop: '0.4rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {finding.patchDiff && (
                <>
                  <button
                    className={styles.btn}
                    onClick={() => applyPatch(finding)}
                  >
                    <GitPullRequest size={12} /> Apply Patch to Code
                  </button>
                  <button
                    className={styles.btn}
                    onClick={() => copyPatch(finding)}
                  >
                    {copiedPatchId === finding.id ? <Check size={12} /> : <Copy size={12} />}
                    {copiedPatchId === finding.id ? 'Copied' : 'Copy Patch'}
                  </button>
                </>
              )}
              <button
                className={styles.btn}
                style={{ marginLeft: 'auto', background: 'rgba(56, 189, 248, 0.15)', borderColor: 'rgba(56, 189, 248, 0.4)' }}
                onClick={() => exportFindingToReport(finding)}
              >
                {exportedFindingId === finding.id ? <Check size={12} color="#38bdf8" /> : <ArrowRight size={12} color="#38bdf8" />}
                {exportedFindingId === finding.id ? 'Added to Report' : 'Send to VAPT Report'}
              </button>
            </div>
          </div>
        ))}

        {findings.length === 0 && (
          <div
            style={{
              padding: '1.5rem',
              textAlign: 'center',
              color: 'var(--text-muted)',
              background: 'var(--card-glass)',
              borderRadius: '8px',
              border: '1px dashed var(--card-border)',
            }}
          >
            <ShieldCheck size={28} style={{ opacity: 0.5, marginBottom: '0.5rem' }} />
            <div>No active vulnerabilities detected in code. Paste source above or click "Fast Scan".</div>
          </div>
        )}
      </div>
    </div>
  );
}
