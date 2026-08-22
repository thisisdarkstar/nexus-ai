import { useState, useEffect, useMemo } from 'react';
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
import ConfirmModal from '../ConfirmModal';
import CustomSelect from '../CustomSelect';
import type { VAPTReport, VulnerabilityFinding, CVSSMetrics, VulnerabilitySeverity } from '../../types';
import styles from './ReportStudio.module.css';

const ASSESSMENT_TYPE_OPTIONS = [
  { value: 'web', label: 'Web Application Pentest', badge: 'Web' },
  { value: 'api', label: 'API Security Assessment', badge: 'API' },
  { value: 'mobile', label: 'Mobile Application Security', badge: 'Mobile' },
  { value: 'network', label: 'Network Infrastructure Pentest', badge: 'Net' },
  { value: 'cloud', label: 'Cloud Architecture Review', badge: 'Cloud' },
  { value: 'bug_bounty', label: 'Bug Bounty Engagement', badge: 'Bounty' },
];

const SEVERITY_OPTIONS = [
  { value: 'critical', label: 'Critical', badge: 'Critical', badgeColor: '#ef4444' },
  { value: 'high', label: 'High', badge: 'High', badgeColor: '#f97316' },
  { value: 'medium', label: 'Medium', badge: 'Medium', badgeColor: '#fbbf24' },
  { value: 'low', label: 'Low', badge: 'Low', badgeColor: '#60a5fa' },
  { value: 'info', label: 'Informational', badge: 'Info', badgeColor: '#94a3b8' },
];

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

  const [subTab, setSubTab] = useState<'editor' | 'markdown' | 'bug_bounty' | 'html'>(() => {
    return (
      (localStorage.getItem('nexus_security_report_subtab') as 'editor' | 'markdown' | 'bug_bounty' | 'html') ||
      'editor'
    );
  });

  useEffect(() => {
    try {
      localStorage.setItem('nexus_security_report_subtab', subTab);
    } catch (e) {
      console.error(e);
    }
  }, [subTab]);
  const [selectedFindingId, setSelectedFindingId] = useState<string | null>(
    report.findings[0]?.id || null
  );
  const [copied, setCopied] = useState(false);

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

  const handleResetReport = () => {
    setModalConfig({
      isOpen: true,
      title: 'Reset Report Findings',
      message: 'Are you sure you want to reset report findings back to the default vulnerability template?',
      confirmLabel: 'Reset Report',
      variant: 'warning',
      onConfirm: () => {
        setReport(SAMPLE_VAPT_REPORT);
        setSelectedFindingId(SAMPLE_VAPT_REPORT.findings[0]?.id || null);
        setModalConfig((prev) => ({ ...prev, isOpen: false }));
      },
    });
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

  const handleDeleteFinding = (findingId: string, findingTitle: string) => {
    setModalConfig({
      isOpen: true,
      title: 'Delete Finding',
      message: `Are you sure you want to delete finding "${findingTitle}" (${findingId})?`,
      confirmLabel: 'Delete Finding',
      variant: 'danger',
      onConfirm: () => {
        setReport((prev) => ({
          ...prev,
          findings: prev.findings.filter((f) => f.id !== findingId),
        }));
        if (selectedFindingId === findingId) {
          setSelectedFindingId(report.findings[0]?.id || null);
        }
        setModalConfig((prev) => ({ ...prev, isOpen: false }));
      },
    });
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

  const [htmlTheme, setHtmlTheme] = useState<'dark' | 'light'>('dark');

  const markdownContent = generateMarkdownReport(report);
  const bugBountyContent = selectedFinding
    ? generateBugBountyMarkdown(selectedFinding, report.targetScope)
    : 'No finding selected';
  const htmlContent = useMemo(() => generateHTMLReport(report, htmlTheme), [report, htmlTheme]);

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
              <CustomSelect
                value={report.assessmentType}
                options={ASSESSMENT_TYPE_OPTIONS}
                onChange={(val) =>
                  setReport({
                    ...report,
                    assessmentType: val as VAPTReport['assessmentType'],
                  })
                }
              />
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
                      onClick={() => handleDeleteFinding(selectedFinding.id, selectedFinding.title)}
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
                            className={`${styles.cvssBtn} ${activeCvss.av === v ? styles.cvssBtnActive : ''}`}
                            onClick={() => handleCvssMetricChange('av', v)}
                          >
                            {v}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className={styles.cvssRow}>
                      <span>Attack Complexity (AC):</span>
                      <div className={styles.cvssBtnGroup}>
                        {(['L', 'H'] as const).map((v) => (
                          <button
                            key={v}
                            className={`${styles.cvssBtn} ${activeCvss.ac === v ? styles.cvssBtnActive : ''}`}
                            onClick={() => handleCvssMetricChange('ac', v)}
                          >
                            {v}
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
                            className={`${styles.cvssBtn} ${activeCvss.pr === v ? styles.cvssBtnActive : ''}`}
                            onClick={() => handleCvssMetricChange('pr', v)}
                          >
                            {v}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className={styles.cvssRow}>
                      <span>User Interaction (UI):</span>
                      <div className={styles.cvssBtnGroup}>
                        {(['N', 'R'] as const).map((v) => (
                          <button
                            key={v}
                            className={`${styles.cvssBtn} ${activeCvss.ui === v ? styles.cvssBtnActive : ''}`}
                            onClick={() => handleCvssMetricChange('ui', v)}
                          >
                            {v}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className={styles.cvssRow}>
                      <span>Scope (S):</span>
                      <div className={styles.cvssBtnGroup}>
                        {(['U', 'C'] as const).map((v) => (
                          <button
                            key={v}
                            className={`${styles.cvssBtn} ${activeCvss.s === v ? styles.cvssBtnActive : ''}`}
                            onClick={() => handleCvssMetricChange('s', v)}
                          >
                            {v}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className={styles.cvssRow}>
                      <span>Confidentiality (C):</span>
                      <div className={styles.cvssBtnGroup}>
                        {(['N', 'L', 'H'] as const).map((v) => (
                          <button
                            key={v}
                            className={`${styles.cvssBtn} ${activeCvss.c === v ? styles.cvssBtnActive : ''}`}
                            onClick={() => handleCvssMetricChange('c', v)}
                          >
                            {v}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className={styles.cvssRow}>
                      <span>Integrity (I):</span>
                      <div className={styles.cvssBtnGroup}>
                        {(['N', 'L', 'H'] as const).map((v) => (
                          <button
                            key={v}
                            className={`${styles.cvssBtn} ${activeCvss.i === v ? styles.cvssBtnActive : ''}`}
                            onClick={() => handleCvssMetricChange('i', v)}
                          >
                            {v}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className={styles.cvssRow}>
                      <span>Availability (A):</span>
                      <div className={styles.cvssBtnGroup}>
                        {(['N', 'L', 'H'] as const).map((v) => (
                          <button
                            key={v}
                            className={`${styles.cvssBtn} ${activeCvss.a === v ? styles.cvssBtnActive : ''}`}
                            onClick={() => handleCvssMetricChange('a', v)}
                          >
                            {v}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                <div className={styles.twoColGrid}>
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
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Severity Level</label>
                    <CustomSelect
                      value={selectedFinding.severity}
                      options={SEVERITY_OPTIONS}
                      onChange={(val) =>
                        handleUpdateFinding(selectedFinding.id, {
                          severity: val as VulnerabilitySeverity,
                        })
                      }
                    />
                  </div>
                </div>

                <div className={styles.twoColGrid}>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>CWE Identifier</label>
                    <input
                      className={styles.input}
                      value={selectedFinding.cweId || ''}
                      placeholder="e.g. CWE-89 or CWE-79"
                      onChange={(e) =>
                        handleUpdateFinding(selectedFinding.id, { cweId: e.target.value })
                      }
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Target Endpoint / Asset</label>
                    <input
                      className={styles.input}
                      value={selectedFinding.targetEndpoint || ''}
                      placeholder="e.g. POST /api/v1/auth/login"
                      onChange={(e) =>
                        handleUpdateFinding(selectedFinding.id, { targetEndpoint: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>Vulnerability Description & Impact</label>
                  <textarea
                    className={styles.textarea}
                    rows={3}
                    value={selectedFinding.description}
                    onChange={(e) =>
                      handleUpdateFinding(selectedFinding.id, { description: e.target.value })
                    }
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>Remediation Guidance</label>
                  <textarea
                    className={styles.textarea}
                    rows={2}
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
          <div className={styles.copyRow}>
            <button
              className={styles.btn}
              onClick={() => handleCopy(markdownContent)}
            >
              {copied ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
              {copied ? 'Copied' : 'Copy Markdown'}
            </button>
            <button
              className={`${styles.btn} ${styles.btnPrimary}`}
              onClick={() => handleDownload(markdownContent, `${report.title.toLowerCase().replace(/\s+/g, '_')}.md`, 'text/markdown')}
            >
              <Download size={12} /> Download .md
            </button>
          </div>
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
              <CustomSelect
                value={selectedFindingId || ''}
                options={report.findings.map((f) => ({
                  value: f.id,
                  label: `[${f.id}] ${f.title}`,
                  badge: f.severity.toUpperCase(),
                  badgeColor: f.severity === 'critical' ? '#ef4444' : f.severity === 'high' ? '#f97316' : f.severity === 'medium' ? '#fbbf24' : '#10b981',
                }))}
                onChange={(val) => setSelectedFindingId(val)}
                style={{ minWidth: '220px' }}
              />
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
          <div className={styles.htmlToolbar}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.76rem', color: '#94a3b8', fontWeight: 600 }}>Theme Mode:</span>
              <div className={styles.tabGroup}>
                <button
                  className={`${styles.subTab} ${htmlTheme === 'dark' ? styles.active : ''}`}
                  onClick={() => setHtmlTheme('dark')}
                >
                  🌙 Dark (Nexus)
                </button>
                <button
                  className={`${styles.subTab} ${htmlTheme === 'light' ? styles.active : ''}`}
                  onClick={() => setHtmlTheme('light')}
                >
                  📄 Light (Print)
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
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
                <Printer size={13} /> Print / Save as PDF
              </button>
            </div>
          </div>
          <iframe
            srcDoc={htmlContent}
            className={styles.reportIframe}
            title="HTML Report Preview"
          />
        </div>
      )}

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
    </div>
  );
}
