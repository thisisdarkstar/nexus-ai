import { useState, useEffect } from 'react';
import {
  FileText,
  Plus,
  Trash2,
  Download,
  Copy,
  Check,
  Calculator,
  Printer,
  Sparkles,
  ExternalLink,
  RotateCcw,
} from 'lucide-react';
import { calculateCVSS31, DEFAULT_CVSS } from '../../lib/security/cvss';
import {
  generateMarkdownReport,
  generateBugBountyMarkdown,
  generateHTMLReport,
  SAMPLE_VAPT_REPORT,
} from '../../lib/security/reportGenerator';
import type { VAPTReport, VulnerabilityFinding, CVSSMetrics, VulnerabilitySeverity } from '../../types';
import styles from './ReportStudio.module.css';

const REPORT_STORAGE_KEY = 'nexus_security_report';

interface ReportStudioProps {
  onSendToAI?: (prompt: string) => void;
}

export default function ReportStudio({ onSendToAI }: ReportStudioProps) {
  const [report, setReport] = useState<VAPTReport>(() => {
    try {
      const saved = localStorage.getItem(REPORT_STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Failed to load report from localStorage:', e);
    }
    return SAMPLE_VAPT_REPORT;
  });

  useEffect(() => {
    try {
      localStorage.setItem(REPORT_STORAGE_KEY, JSON.stringify(report));
    } catch (e) {
      console.error('Failed to save report to localStorage:', e);
    }
  }, [report]);

  const [subTab, setSubTab] = useState<'editor' | 'markdown' | 'bug_bounty' | 'html'>('editor');
  const [selectedFindingId, setSelectedFindingId] = useState<string | null>(
    report.findings[0]?.id || null
  );
  const [copied, setCopied] = useState(false);

  const handleResetReport = () => {
    if (window.confirm('Reset report findings back to sample report?')) {
      setReport(SAMPLE_VAPT_REPORT);
      setSelectedFindingId(SAMPLE_VAPT_REPORT.findings[0]?.id || null);
    }
  };

  // CVSS Modal state for currently edited finding
  const [isCvssOpen, setIsCvssOpen] = useState(false);
  const [activeCvss, setActiveCvss] = useState<CVSSMetrics>(
    report.findings[0]?.cvss || DEFAULT_CVSS
  );

  const selectedFinding = report.findings.find((f) => f.id === selectedFindingId);

  const handleUpdateFinding = (findingId: string, updates: Partial<VulnerabilityFinding>) => {
    setReport((prev) => ({
      ...prev,
      findings: prev.findings.map((f) => (f.id === findingId ? { ...f, ...updates } : f)),
    }));
  };

  const handleAddFinding = () => {
    const newId = `FINDING-${String(report.findings.length + 1).padStart(3, '0')}`;
    const newFinding: VulnerabilityFinding = {
      id: newId,
      title: 'New Security Finding',
      severity: 'medium',
      cweId: 'CWE-200',
      owaspCategory: 'A01:2021 - Broken Access Control',
      targetEndpoint: '/api/v1/resource',
      description: 'Describe the technical flaw and exposure condition.',
      remediation: 'Implement proper authorization and sanitization routines.',
      pocSteps: ['1. Navigate to target.', '2. Send malicious request.', '3. Verify response.'],
      cvss: DEFAULT_CVSS,
      status: 'open',
    };
    setReport((prev) => ({ ...prev, findings: [...prev.findings, newFinding] }));
    setSelectedFindingId(newId);
  };

  const handleDeleteFinding = (findingId: string) => {
    setReport((prev) => ({
      ...prev,
      findings: prev.findings.filter((f) => f.id !== findingId),
    }));
    if (selectedFindingId === findingId) {
      setSelectedFindingId(report.findings[0]?.id || null);
    }
  };

  const handleCvssMetricChange = (metric: keyof CVSSMetrics, val: string) => {
    const updated = calculateCVSS31({
      ...activeCvss,
      [metric]: val,
    } as Omit<CVSSMetrics, 'score' | 'severity' | 'vectorString'>);
    setActiveCvss(updated);
  };

  const handleApplyCvss = () => {
    if (selectedFindingId) {
      handleUpdateFinding(selectedFindingId, {
        cvss: activeCvss,
        severity: activeCvss.severity,
      });
    }
    setIsCvssOpen(false);
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const markdownContent = generateMarkdownReport(report);
  const bugBountyContent = selectedFinding
    ? generateBugBountyMarkdown(selectedFinding, report.targetScope)
    : 'No finding selected';
  const htmlContent = generateHTMLReport(report);

  return (
    <div className={styles.reportContainer}>
      {/* Top Header & Sub-Tabs */}
      <div className={styles.topBar}>
        <div className={styles.tabGroup}>
          <button
            className={`${styles.subTab} ${subTab === 'editor' ? styles.active : ''}`}
            onClick={() => setSubTab('editor')}
          >
            Findings Editor
          </button>
          <button
            className={`${styles.subTab} ${subTab === 'markdown' ? styles.active : ''}`}
            onClick={() => setSubTab('markdown')}
          >
            Markdown Report
          </button>
          <button
            className={`${styles.subTab} ${subTab === 'bug_bounty' ? styles.active : ''}`}
            onClick={() => setSubTab('bug_bounty')}
          >
            Bug Bounty Format
          </button>
          <button
            className={`${styles.subTab} ${subTab === 'html' ? styles.active : ''}`}
            onClick={() => setSubTab('html')}
          >
            HTML / Print
          </button>
        </div>

        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
          <button
            className={styles.btn}
            onClick={handleResetReport}
            title="Reset to Sample Report"
          >
            <RotateCcw size={12} /> Reset
          </button>
          {onSendToAI && (
            <button
              className={styles.btn}
              onClick={() =>
                onSendToAI(
                  `Review and enhance this VAPT Report draft:\n\n${markdownContent.slice(0, 3000)}`
                )
              }
              title="Send report to AI for executive review and polish"
            >
              <Sparkles size={13} color="var(--accent-color)" /> AI Review
            </button>
          )}
          <button
            className={styles.btn}
            onClick={() =>
              handleCopy(
                subTab === 'markdown'
                  ? markdownContent
                  : subTab === 'bug_bounty'
                    ? bugBountyContent
                    : htmlContent
              )
            }
          >
            {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? 'Copied' : 'Copy'}
          </button>
          <button
            className={`${styles.btn} ${styles.btnPrimary}`}
            onClick={() =>
              handleDownload(
                subTab === 'html' ? htmlContent : markdownContent,
                `${report.title.toLowerCase().replace(/\\s+/g, '_')}.${subTab === 'html' ? 'html' : 'md'}`,
                subTab === 'html' ? 'text/html' : 'text/markdown'
              )
            }
          >
            <Download size={13} /> Export
          </button>
        </div>
      </div>

      {subTab === 'editor' && (
        <>
          {/* Assessment Metadata */}
          <div className={styles.metaGrid}>
            <div className={styles.formGroup}>
              <label className={styles.label}>Report Title</label>
              <input
                className={styles.input}
                value={report.title}
                onChange={(e) => setReport({ ...report, title: e.target.value })}
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label}>Client Name</label>
              <input
                className={styles.input}
                value={report.clientName}
                onChange={(e) => setReport({ ...report, clientName: e.target.value })}
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label}>Assessment Type</label>
              <select
                className={styles.select}
                value={report.assessmentType}
                onChange={(e) =>
                  setReport({
                    ...report,
                    assessmentType: e.target.value as VAPTReport['assessmentType'],
                  })
                }
              >
                <option value="web">Web Application Pentest</option>
                <option value="api">API Security Assessment</option>
                <option value="mobile">Mobile Application Security</option>
                <option value="network">Network Infrastructure Pentest</option>
                <option value="cloud">Cloud Architecture Review</option>
                <option value="bug_bounty">Bug Bounty Engagement</option>
              </select>
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label}>Target Scope</label>
              <input
                className={styles.input}
                value={report.targetScope}
                onChange={(e) => setReport({ ...report, targetScope: e.target.value })}
              />
            </div>
          </div>

          {/* Findings List & Selected Finding Editor */}
          <div className={styles.findingsHeader}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>
              Technical Findings ({report.findings.length})
            </span>
            <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleAddFinding}>
              <Plus size={13} /> Add Finding
            </button>
          </div>

          <div className={styles.findingsContainer}>
            {/* Finding Selector Sidebar */}
            <div className={styles.findingSidebar}>
              {report.findings.map((f) => (
                <div
                  key={f.id}
                  onClick={() => {
                    setSelectedFindingId(f.id);
                    if (f.cvss) setActiveCvss(f.cvss);
                  }}
                  className={`${styles.findingItem}`}
                  style={{
                    cursor: 'pointer',
                    border:
                      selectedFindingId === f.id
                        ? '1px solid var(--accent-color, #10b981)'
                        : undefined,
                  }}
                >
                  <div className={styles.findingTop}>
                    <span className={`${styles.severityBadge} ${styles[f.severity]}`}>
                      {f.severity}
                    </span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{f.id}</span>
                  </div>
                  <span
                    style={{
                      fontSize: '0.8rem',
                      fontWeight: 500,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {f.title}
                  </span>
                </div>
              ))}
            </div>

            {/* Selected Finding Detail Form */}
            {selectedFinding && (
              <div className={styles.findingDetailForm}>
                <div
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.4rem' }}
                >
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <span className={`${styles.severityBadge} ${styles[selectedFinding.severity]}`}>
                      {selectedFinding.severity}
                    </span>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                      {selectedFinding.id}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <button
                      className={styles.btn}
                      onClick={() => setIsCvssOpen(!isCvssOpen)}
                      title="Calculate CVSS v3.1 score"
                    >
                      <Calculator size={13} /> CVSS ({selectedFinding.cvss?.score || 'N/A'})
                    </button>
                    <button
                      className={styles.btn}
                      style={{ color: '#ef4444' }}
                      onClick={() => handleDeleteFinding(selectedFinding.id)}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* CVSS Modal Accordion */}
                {isCvssOpen && (
                  <div className={styles.cvssBox}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <span style={{ fontWeight: 600, fontSize: '0.85rem', color: '#10b981' }}>
                        CVSS v3.1 Base Score: {activeCvss.score} ({activeCvss.severity.toUpperCase()})
                      </span>
                      <button
                        className={`${styles.btn} ${styles.btnPrimary}`}
                        onClick={handleApplyCvss}
                      >
                        Apply Score
                      </button>
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                      Vector: <code>{activeCvss.vectorString}</code>
                    </div>

                    <div className={styles.cvssRow}>
                      <span>Attack Vector (AV):</span>
                      <div className={styles.cvssBtnGroup}>
                        {(['N', 'A', 'L', 'P'] as const).map((v) => (
                          <button
                            key={v}
                            className={`${styles.cvssOptionBtn} ${activeCvss.av === v ? styles.active : ''}`}
                            onClick={() => handleCvssMetricChange('av', v)}
                          >
                            {v === 'N' ? 'Network' : v === 'A' ? 'Adjacent' : v === 'L' ? 'Local' : 'Physical'}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className={styles.cvssRow}>
                      <span>Privileges Required (PR):</span>
                      <div className={styles.cvssBtnGroup}>
                        {(['N', 'L', 'H'] as const).map((v) => (
                          <button
                            key={v}
                            className={`${styles.cvssOptionBtn} ${activeCvss.pr === v ? styles.active : ''}`}
                            onClick={() => handleCvssMetricChange('pr', v)}
                          >
                            {v === 'N' ? 'None' : v === 'L' ? 'Low' : 'High'}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className={styles.cvssRow}>
                      <span>Confidentiality (C):</span>
                      <div className={styles.cvssBtnGroup}>
                        {(['H', 'L', 'N'] as const).map((v) => (
                          <button
                            key={v}
                            className={`${styles.cvssOptionBtn} ${activeCvss.c === v ? styles.active : ''}`}
                            onClick={() => handleCvssMetricChange('c', v)}
                          >
                            {v === 'H' ? 'High' : v === 'L' ? 'Low' : 'None'}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                <div className={styles.formGroup}>
                  <label className={styles.label}>Finding Title</label>
                  <input
                    className={styles.input}
                    value={selectedFinding.title}
                    onChange={(e) =>
                      handleUpdateFinding(selectedFinding.id, { title: e.target.value })
                    }
                  />
                </div>

                <div className={styles.twoColGrid}>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>CWE ID</label>
                    <input
                      className={styles.input}
                      value={selectedFinding.cweId || ''}
                      onChange={(e) =>
                        handleUpdateFinding(selectedFinding.id, { cweId: e.target.value })
                      }
                      placeholder="e.g. CWE-89"
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Target Endpoint / Asset</label>
                    <input
                      className={styles.input}
                      value={selectedFinding.targetEndpoint || ''}
                      onChange={(e) =>
                        handleUpdateFinding(selectedFinding.id, { targetEndpoint: e.target.value })
                      }
                      placeholder="e.g. POST /api/v1/login"
                    />
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>Vulnerability Description & Impact</label>
                  <textarea
                    rows={4}
                    className={styles.textarea}
                    value={selectedFinding.description}
                    onChange={(e) =>
                      handleUpdateFinding(selectedFinding.id, { description: e.target.value })
                    }
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>Remediation & Fix Instructions</label>
                  <textarea
                    rows={3}
                    className={styles.textarea}
                    value={selectedFinding.remediation}
                    onChange={(e) =>
                      handleUpdateFinding(selectedFinding.id, { remediation: e.target.value })
                    }
                  />
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {subTab === 'markdown' && (
        <div className={styles.previewContainer}>
          <textarea
            className={styles.previewCode}
            value={markdownContent}
            readOnly
            spellCheck={false}
          />
        </div>
      )}

      {subTab === 'bug_bounty' && (
        <div className={styles.previewContainer}>
          <div className={styles.findingSelectorRow}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>Active Finding:</span>
              <select
                className={styles.select}
                value={selectedFindingId || ''}
                onChange={(e) => setSelectedFindingId(e.target.value)}
              >
                {report.findings.map((f) => (
                  <option key={f.id} value={f.id}>
                    [{f.id}] {f.title} ({f.severity.toUpperCase()})
                  </option>
                ))}
              </select>
            </div>
            {selectedFinding?.cvss && (
              <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 500 }}>
                CVSS v3.1: {selectedFinding.cvss.score} ({selectedFinding.cvss.severity.toUpperCase()})
              </span>
            )}
          </div>
          <textarea
            className={styles.previewCode}
            value={bugBountyContent}
            readOnly
            spellCheck={false}
          />
        </div>
      )}

      {subTab === 'html' && (
        <div className={styles.iframeContainer}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button
              className={`${styles.btn} ${styles.btnPrimary}`}
              onClick={() => {
                const win = window.open('', '_blank');
                if (win) {
                  win.document.write(htmlContent);
                  win.document.close();
                }
              }}
            >
              <Printer size={13} /> Open in Print View (PDF)
            </button>
          </div>
          <iframe
            srcDoc={htmlContent}
            className={styles.reportIframe}
            title="HTML Report Preview"
          />
        </div>
      )}
    </div>
  );
}
