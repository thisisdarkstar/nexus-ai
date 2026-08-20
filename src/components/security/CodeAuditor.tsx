import { useState } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  RotateCcw,
  Check,
  Copy,
  GitPullRequest,
  FileCode,
} from 'lucide-react';
import type { VulnerabilityFinding } from '../../types';
import styles from './CodeAuditor.module.css';

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

export default function CodeAuditor({
  initialCode,
  onSendToAI,
}: CodeAuditorProps) {
  const [code, setCode] = useState(initialCode || SAMPLE_VULNERABILITIES[0].code);
  const [language, setLanguage] = useState('python');
  const [findings, setFindings] = useState<VulnerabilityFinding[]>([
    SAMPLE_VULNERABILITIES[0].finding,
  ]);
  const [copiedPatchId, setCopiedPatchId] = useState<string | null>(null);

  const handleSelectSample = (sampleId: string) => {
    const sample = SAMPLE_VULNERABILITIES.find((s) => s.id === sampleId);
    if (sample) {
      setCode(sample.code);
      setLanguage(sample.language);
      setFindings([sample.finding]);
    }
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

  return (
    <div className={styles.auditorContainer}>
      {/* Top Controls */}
      <div className={styles.topBar}>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <select
            className={styles.select}
            onChange={(e) => handleSelectSample(e.target.value)}
            defaultValue={SAMPLE_VULNERABILITIES[0].id}
          >
            <option disabled>-- Sample Vulnerability Templates --</option>
            {SAMPLE_VULNERABILITIES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <select
            className={styles.select}
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
          >
            <option value="python">Python</option>
            <option value="javascript">JavaScript</option>
            <option value="typescript">TypeScript</option>
            <option value="go">Go</option>
            <option value="java">Java</option>
            <option value="c">C / C++</option>
            <option value="php">PHP</option>
            <option value="solidity">Solidity</option>
          </select>
        </div>

        <button
          className={`${styles.btn} ${styles.btnPrimary}`}
          onClick={handleAuditRequest}
        >
          <Sparkles size={14} /> Audit with AppSec AI
        </button>
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
          onChange={(e) => setCode(e.target.value)}
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
              <div style={{ display: 'flex', gap: '0.4rem' }}>
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
              <>
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

                <div className={styles.actionRow} style={{ marginTop: '0.25rem' }}>
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
                </div>
              </>
            )}
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
            <div>No active findings recorded. Paste code above and click "Audit with AppSec AI".</div>
          </div>
        )}
      </div>
    </div>
  );
}
