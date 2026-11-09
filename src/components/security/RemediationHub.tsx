import React, { useState, useEffect, useMemo } from 'react';
import {
  Wrench,
  CheckCircle,
  AlertTriangle,
  Code2,
  FileCheck,
  Check,
  RotateCcw,
  Sparkles,
  ArrowRight,
  Shield,
  Layers,
  Download,
  Copy,
} from 'lucide-react';
import CustomSelect from '../common/CustomSelect';
import { workbenchBridge } from '../../lib/security/workbenchBridge';
import { RegressionTestGenerator } from '../../domain/remediation/RegressionTestGenerator';
import type { VulnerabilityFinding, VulnerabilitySeverity } from '../../types';
import styles from './RemediationHub.module.css';

interface RemediationHubProps {
  onSendToAI: (prompt: string) => void;
}

const DEFAULT_FINDINGS: VulnerabilityFinding[] = [
  {
    id: 'f-sqli-01',
    title: 'SQL Injection in User Search Parameter',
    severity: 'critical',
    cweId: 'CWE-89',
    owaspCategory: 'A03:2021-Injection',
    targetEndpoint: 'GET /api/v1/users/search?q=',
    description: 'Dynamic string interpolation into SQL query allows unauthenticated database extraction.',
    remediation: 'Use parameterized queries with prepared statements. Pass user inputs as explicit parameter bindings.',
    status: 'open',
  },
  {
    id: 'f-ssrf-02',
    title: 'Server-Side Request Forgery (SSRF) in Document Fetcher',
    severity: 'high',
    cweId: 'CWE-918',
    owaspCategory: 'A10:2021-Server-Side Request Forgery',
    targetEndpoint: 'POST /api/v2/fetch_document?url=',
    description: 'Server retrieves user-supplied URL without destination allowlist validation.',
    remediation: 'Validate destination against strict domain allowlist. Disable HTTP redirects and block loopback/metadata IP ranges.',
    status: 'triaged',
  },
  {
    id: 'f-idor-03',
    title: 'Broken Object-Level Authorization (BOLA/IDOR) in Accounts',
    severity: 'high',
    cweId: 'CWE-639',
    owaspCategory: 'A01:2021-Broken Access Control',
    targetEndpoint: 'GET /api/v1/accounts?user_id=',
    description: 'Endpoint lacks server-side authorization checks comparing caller token claims against the requested account ID.',
    remediation: 'Verify user token claims against the owner_id of the database record prior to returning account balances.',
    status: 'open',
  },
];

interface GeneratedDiff {
  vulnerable: string[];
  patched: string[];
}

function synthesizeDiff(finding: VulnerabilityFinding): GeneratedDiff {
  const cwe = finding.cweId || '';
  const title = finding.title.toLowerCase();

  if (cwe.includes('89') || title.includes('sql')) {
    return {
      vulnerable: [
        '# VULNERABLE: Direct string interpolation into SQL query',
        'def search_users(user_query):',
        '-   query = f"SELECT * FROM users WHERE name LIKE \'%{user_query}%\'"',
        '-   cursor.execute(query)',
        '-   return cursor.fetchall()',
      ],
      patched: [
        '# SECURE: Parameterized prepared statement with query placeholder',
        'def search_users(user_query):',
        '+   query = "SELECT * FROM users WHERE name LIKE %s"',
        '+   cursor.execute(query, (f"%{user_query}%",))',
        '+   return cursor.fetchall()',
      ],
    };
  }

  if (cwe.includes('918') || title.includes('ssrf')) {
    return {
      vulnerable: [
        '# VULNERABLE: Coercing server to fetch unvalidated destination',
        'def fetch_document(target_url):',
        '-   response = requests.get(target_url)',
        '-   return response.content',
      ],
      patched: [
        '# SECURE: Strict allowlist validation & metadata blocking',
        'ALLOWED_DOMAINS = {"documents.acmefinance.com", "cdn.acmefinance.com"}',
        'def fetch_document(target_url):',
        '+   domain = urlparse(target_url).hostname',
        '+   if domain not in ALLOWED_DOMAINS:',
        '+       raise PermissionError("Destination domain rejected by security allowlist")',
        '+   return requests.get(target_url, allow_redirects=False, timeout=3.0).content',
      ],
    };
  }

  if (cwe.includes('639') || title.includes('idor') || title.includes('bola')) {
    return {
      vulnerable: [
        '# VULNERABLE: Blindly trusting client-supplied user_id',
        '@app.get("/api/v1/accounts")',
        'def get_account(user_id: int):',
        '-   return db.query(Account).filter_by(user_id=user_id).first()',
      ],
      patched: [
        '# SECURE: Server-side token authorization check',
        '@app.get("/api/v1/accounts")',
        'def get_account(user_id: int, current_user = Depends(get_current_user)):',
        '+   if current_user.id != user_id and not current_user.is_admin:',
        '+       raise HTTPException(status_code=403, detail="Unauthorized resource access")',
        '+   return db.query(Account).filter_by(user_id=user_id).first()',
      ],
    };
  }

  return {
    vulnerable: [
      `// VULNERABLE PATTERN (${finding.cweId || 'Identified Flaw'}):`,
      `- // Unchecked inputs or insecure configuration at ${finding.targetEndpoint || 'target'}`,
      `- // ${finding.description.substring(0, 80)}...`,
    ],
    patched: [
      `// SECURE REMEDIATION PATTERN:`,
      `+ // Enforce defensive bounds: ${finding.remediation.substring(0, 80)}...`,
      `+ // Validate all incoming arguments against strict type constraints.`,
    ],
  };
}

export default function RemediationHub({ onSendToAI }: RemediationHubProps) {
  const [findings, setFindings] = useState<VulnerabilityFinding[]>(() => {
    try {
      const raw = localStorage.getItem('nexus_security_report');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.findings) && parsed.findings.length > 0) {
          return parsed.findings;
        }
      }
    } catch {
      // fallback
    }
    return DEFAULT_FINDINGS;
  });

  const [selectedId, setSelectedId] = useState<string>(findings[0]?.id || '');
  const [verificationSteps, setVerificationSteps] = useState<Record<string, boolean>>({});
  const [testFramework, setTestFramework] = useState<'pytest' | 'jest' | 'curl'>('pytest');
  const [testCopied, setTestCopied] = useState<boolean>(false);

  const selectedFinding = useMemo(() => {
    return findings.find((f) => f.id === selectedId) || findings[0];
  }, [findings, selectedId]);

  const generatedSuite = useMemo(() => {
    if (!selectedFinding) return null;
    if (testFramework === 'pytest') return RegressionTestGenerator.generatePyTest(selectedFinding);
    if (testFramework === 'jest') return RegressionTestGenerator.generateJest(selectedFinding);
    return RegressionTestGenerator.generateCurlScript(selectedFinding);
  }, [selectedFinding, testFramework]);

  const diff = useMemo(() => {
    if (!selectedFinding) return null;
    return synthesizeDiff(selectedFinding);
  }, [selectedFinding]);

  const metrics = useMemo(() => {
    const total = findings.length;
    const fixed = findings.filter((f) => f.status === 'fixed' || f.status === 'retested').length;
    const inProgress = findings.filter((f) => f.status === 'triaged').length;
    const open = findings.filter((f) => !f.status || f.status === 'open').length;
    return { total, fixed, inProgress, open };
  }, [findings]);

  const handleStatusChange = (newStatus: VulnerabilityFinding['status']) => {
    if (!selectedFinding) return;
    setFindings((prev) =>
      prev.map((f) => (f.id === selectedFinding.id ? { ...f, status: newStatus } : f))
    );
  };

  const handleToggleCheck = (stepKey: string) => {
    setVerificationSteps((prev) => ({
      ...prev,
      [`${selectedId}_${stepKey}`]: !prev[`${selectedId}_${stepKey}`],
    }));
  };

  const handleAskAIVerification = () => {
    if (!selectedFinding) return;
    const prompt = `As a Senior Application Security Engineer, outline the exact defensive verification plan for:
- **Vulnerability**: ${selectedFinding.title} (${selectedFinding.cweId || 'Security Finding'})
- **Severity**: ${(selectedFinding.severity || 'high').toUpperCase()}
- **Target**: \`${selectedFinding.targetEndpoint || 'N/A'}\`
- **Remediation**: ${selectedFinding.remediation}

Please provide:
1. Exact non-destructive \`curl\` / Python tests to verify whether the patch successfully closed the vulnerability.
2. Negative test cases (edge cases like bypasses, encoding tricks, boundary values) to guarantee no regressions.
3. Unit test code snippet using standard testing frameworks (pytest / jest).`;
    onSendToAI(prompt);
  };

  return (
    <div className={styles.container}>
      {/* Top Header & Metrics Strip */}
      <div className={styles.topBar}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Wrench size={16} color="#10b981" />
          <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Remediation Workspace & Verification Hub</span>
        </div>
      </div>

      <div className={styles.metricsStrip}>
        <div className={styles.metricCard}>
          <div className={styles.metricInfo}>
            <span className={styles.metricLabel}>Total Findings</span>
            <span className={styles.metricValue}>{metrics.total}</span>
          </div>
          <Layers size={18} color="#38bdf8" />
        </div>

        <div className={styles.metricCard}>
          <div className={styles.metricInfo}>
            <span className={styles.metricLabel}>Verified Fixed</span>
            <span className={styles.metricValue} style={{ color: '#10b981' }}>
              {metrics.fixed}
            </span>
          </div>
          <CheckCircle size={18} color="#10b981" />
        </div>

        <div className={styles.metricCard}>
          <div className={styles.metricInfo}>
            <span className={styles.metricLabel}>Triaged / In Progress</span>
            <span className={styles.metricValue} style={{ color: '#f59e0b' }}>
              {metrics.inProgress}
            </span>
          </div>
          <AlertTriangle size={18} color="#f59e0b" />
        </div>

        <div className={styles.metricCard}>
          <div className={styles.metricInfo}>
            <span className={styles.metricLabel}>Open Findings</span>
            <span className={styles.metricValue} style={{ color: '#ef4444' }}>
              {metrics.open}
            </span>
          </div>
          <Shield size={18} color="#ef4444" />
        </div>
      </div>

      {/* Main Split Grid */}
      <div className={styles.workspaceGrid}>
        {/* Left Findings Sidebar */}
        <div className={styles.findingsSidebar}>
          {findings.map((f) => {
            const isSelected = f.id === selectedId;
            return (
              <div
                key={f.id}
                className={`${styles.findingItem} ${isSelected ? styles.findingItemActive : ''}`}
                onClick={() => setSelectedId(f.id)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.68rem', fontWeight: 700, color: f.severity === 'critical' ? '#ef4444' : '#f59e0b' }}>
                    {f.severity?.toUpperCase()}
                  </span>
                  <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>{f.status || 'open'}</span>
                </div>
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#f8fafc', lineHeight: 1.35 }}>
                  {f.title}
                </span>
                <span style={{ fontSize: '0.68rem', color: '#64748b', fontFamily: 'JetBrains Mono, monospace' }}>
                  {f.cweId || 'Finding'}
                </span>
              </div>
            );
          })}
        </div>

        {/* Right Detail & Diff Panel */}
        {selectedFinding ? (
          <div className={styles.detailPanel}>
            {/* Title & Status Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, color: '#f8fafc' }}>
                  {selectedFinding.title}
                </h3>
                <span style={{ fontSize: '0.74rem', color: '#94a3b8' }}>
                  {selectedFinding.cweId} • {selectedFinding.owaspCategory || 'OWASP Top 10'} • Target: {selectedFinding.targetEndpoint || 'N/A'}
                </span>
              </div>

              <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                <CustomSelect
                  value={selectedFinding.status || 'open'}
                  onChange={handleStatusChange}
                  options={[
                    { value: 'open', label: '🔴 Status: Open' },
                    { value: 'triaged', label: '🟡 Status: Triaged / In Progress' },
                    { value: 'fixed', label: '🟢 Status: Fixed (Pending Retest)' },
                    { value: 'retested', label: '✅ Status: Retested & Verified' },
                    { value: 'accepted', label: '⚪ Status: Accepted Risk' },
                  ]}
                  style={{ minWidth: '180px' }}
                />
                <button
                  className={`${styles.btn} ${styles.btnPrimary}`}
                  onClick={handleAskAIVerification}
                  title="Ask AI for step-by-step re-testing and verification commands"
                >
                  <Sparkles size={12} /> AI Re-test Guide
                </button>
              </div>
            </div>

            {/* Root-Cause & Guidance Box */}
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '6px', padding: '0.65rem 0.8rem' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: '#94a3b8', marginBottom: '0.2rem' }}>
                Remediation Rationale & Standard
              </div>
              <div style={{ fontSize: '0.8rem', color: '#e2e8f0', lineHeight: 1.5 }}>
                {selectedFinding.remediation}
              </div>
            </div>

            {/* Side-by-Side Unified Patch Diff */}
            {diff && (
              <div className={styles.diffBox}>
                <div className={styles.diffHeader}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Code2 size={13} color="#10b981" />
                    <span>Suggested Secure Code Patch Comparison</span>
                  </div>
                  <span>Unified Diff View</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {diff.vulnerable.map((line, idx) => (
                    <div key={`v-${idx}`} className={styles.diffLineRemoved}>
                      {line}
                    </div>
                  ))}
                  {diff.patched.map((line, idx) => (
                    <div key={`p-${idx}`} className={styles.diffLineAdded}>
                      {line}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Verification Checklist */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.25rem' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: '#94a3b8' }}>
                Fix Verification & Review Checklist
              </div>
              <div className={styles.checklist}>
                {[
                  { key: 'review', label: '1. Secure coding fix reviewed & approved by security/lead engineer' },
                  { key: 'tests', label: '2. Negative boundary unit tests added to CI/CD pipeline' },
                  { key: 'staging', label: '3. Staging deployment re-tested with non-destructive verification payloads' },
                  { key: 'prod', label: '4. Production deployment verified clean with monitoring confirmation' },
                ].map((item) => {
                  const isChecked = !!verificationSteps[`${selectedId}_${item.key}`];
                  return (
                    <div
                      key={item.key}
                      className={`${styles.checkItem} ${isChecked ? styles.checkItemDone : ''}`}
                      onClick={() => handleToggleCheck(item.key)}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}}
                        style={{ cursor: 'pointer', accentColor: '#10b981' }}
                      />
                      <span>{item.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Automated Regression Test Suite Generator */}
            {generatedSuite && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem', background: 'rgba(0,0,0,0.25)', padding: '0.85rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Code2 size={14} color="#38bdf8" />
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#f1f5f9' }}>
                      Automated Regression Test Generator
                    </span>
                    <span style={{ fontSize: '0.65rem', background: 'rgba(234,179,8,0.15)', color: '#fbbf24', border: '1px solid rgba(234,179,8,0.3)', padding: '0.1rem 0.35rem', borderRadius: '4px' }}>
                      Not Executed (Template)
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                    {(['pytest', 'jest', 'curl'] as const).map((fw) => (
                      <button
                        key={fw}
                        type="button"
                        style={{
                          background: testFramework === fw ? '#0284c7' : 'rgba(255,255,255,0.05)',
                          border: '1px solid rgba(255,255,255,0.12)',
                          color: '#fff',
                          borderRadius: '4px',
                          padding: '0.2rem 0.5rem',
                          fontSize: '0.7rem',
                          cursor: 'pointer',
                          fontWeight: testFramework === fw ? 700 : 500,
                        }}
                        onClick={() => setTestFramework(fw)}
                      >
                        {fw === 'pytest' ? 'PyTest' : fw === 'jest' ? 'Jest (TS)' : 'cURL (Bash)'}
                      </button>
                    ))}

                    <button
                      type="button"
                      style={{
                        background: 'rgba(255,255,255,0.08)',
                        border: '1px solid rgba(255,255,255,0.15)',
                        color: '#fff',
                        borderRadius: '4px',
                        padding: '0.2rem 0.5rem',
                        fontSize: '0.7rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.2rem',
                      }}
                      onClick={() => {
                        navigator.clipboard.writeText(generatedSuite.testCode);
                        setTestCopied(true);
                        setTimeout(() => setTestCopied(false), 1500);
                      }}
                    >
                      {testCopied ? <Check size={11} color="#10b981" /> : <Copy size={11} />}
                      {testCopied ? 'Copied' : 'Copy'}
                    </button>

                    <button
                      type="button"
                      style={{
                        background: 'rgba(255,255,255,0.08)',
                        border: '1px solid rgba(255,255,255,0.15)',
                        color: '#fff',
                        borderRadius: '4px',
                        padding: '0.2rem 0.5rem',
                        fontSize: '0.7rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.2rem',
                      }}
                      onClick={() => {
                        const blob = new Blob([generatedSuite.testCode], { type: 'text/plain' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = generatedSuite.fileName;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                      }}
                    >
                      <Download size={11} /> Download
                    </button>
                  </div>
                </div>

                <pre style={{ margin: 0, padding: '0.65rem', background: 'rgba(0,0,0,0.5)', borderRadius: '6px', fontFamily: 'monospace', fontSize: '0.74rem', color: '#cbd5e1', overflowX: 'auto', maxHeight: '160px' }}>
                  <code>{generatedSuite.testCode}</code>
                </pre>
                <div style={{ fontSize: '0.68rem', color: '#64748b' }}>
                  Run in developer environment: <code>{generatedSuite.verificationCommand}</code>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className={styles.emptyState}>
            <FileCheck size={32} color="#64748b" />
            <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>No findings in active project</span>
            <span style={{ fontSize: '0.78rem' }}>
              Import a security scan artifact or file findings in Report Studio to begin remediation tracking.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

