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
  RotateCcw,
  ListChecks,
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
import { SEVERITY_OPTIONS } from '../../data/security/reportTemplates';
import ReportMetaBar from './reports/ReportMetaBar';
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

  const [subTab, setSubTab] = useState<'editor' | 'markdown' | 'bug_bounty' | 'html'>(() => {
    try {
      return (
        (localStorage.getItem('nexus_security_report_subtab') as 'editor' | 'markdown' | 'bug_bounty' | 'html') ||
        'editor'
      );
    } catch {
      return 'editor';
    }
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

  // CVSS Calculator state
  const [showCvssCalculator, setShowCvssCalculator] = useState(false);

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
    if (!selectedFinding) return;
    const currentCvss = selectedFinding.cvss || DEFAULT_CVSS;
    const updated = calculateCVSS31({
      ...currentCvss,
      [metric]: val,
    } as Omit<CVSSMetrics, 'score' | 'severity' | 'vectorString'>);
    handleUpdateFinding(selectedFinding.id, {
      cvss: updated,
      severity: updated.severity,
    });
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

  const activeCvss = selectedFinding?.cvss || DEFAULT_CVSS;

  // Structured per-finding summary so the AI reviews every finding without a
  // hard truncation of the full report (long fields are trimmed individually).
  const buildAllFindingsPrompt = () => {
    const findingsSummary = report.findings
      .map((f, idx) => {
        const cvss = f.cvss
          ? `${f.cvss.score} ${f.cvss.severity.toUpperCase()} (${f.cvss.vectorString})`
          : 'Not scored';
        return [
          `### Finding ${idx + 1}: [${f.id}] ${f.title}`,
          `- Severity: ${f.severity.toUpperCase()}`,
          f.cweId ? `- CWE: ${f.cweId}` : '',
          f.owaspCategory ? `- OWASP Category: ${f.owaspCategory}` : '',
          f.targetEndpoint ? `- Target: ${f.targetEndpoint}` : '',
          `- CVSS v3.1: ${cvss}`,
          `- Status: ${f.status}`,
          `- Description: ${(f.description || '').trim().slice(0, 700)}${(f.description || '').length > 700 ? '…' : ''}`,
          `- Remediation: ${(f.remediation || '').trim().slice(0, 500)}${(f.remediation || '').length > 500 ? '…' : ''}`,
        ]
          .filter(Boolean)
          .join('\n');
      })
      .join('\n\n');

    return `I have completed a VAPT assessment and need an expert review of ALL ${report.findings.length} findings.

**Engagement**: ${report.title}${report.targetScope ? `\n**Target Scope**: ${report.targetScope}` : ''}

${findingsSummary}

Please act as a senior application security consultant reviewing this complete findings set:
1. **Severity Validation**: Are the CVSS scores and severities justified? Flag any over/under-scored findings with corrected vectors.
2. **Risk Prioritization**: Provide a remediation order considering exploitability, business impact, and effort.
3. **Cross-Finding Attack Chains**: Identify combinations of findings that could be chained into higher-impact exploits.
4. **Missing Coverage**: Based on the scope and these findings, what common vulnerability classes appear untested or unreported?
5. **Executive Summary**: Draft a concise 150-word executive summary for the client.`;
  };

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
            <>
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
              <button
                className={styles.btn}
                onClick={() => onSendToAI(buildAllFindingsPrompt())}
                disabled={report.findings.length === 0}
                title="Structured AI analysis of every finding (CVSS, severity, remediation) with no truncation"
              >
                <ListChecks size={13} color="var(--accent-color)" /> AI Analyze All Findings
              </button>
            </>
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
                `${report.title.toLowerCase().replace(/\s+/g, '_')}.${subTab === 'html' ? 'html' : 'md'}`,
                subTab === 'html' ? 'text/html' : 'text/markdown'
              )
            }
          >
            <Download size={13} /> Export
          </button>
        </div>
      </div>

      {subTab === 'editor' && (
        <div className={styles.editorTabContent}>
          {/* Assessment Metadata Bar */}
          <ReportMetaBar
            report={report}
            onUpdateMeta={(updates) => setReport((prev) => ({ ...prev, ...updates }))}
          />

          <div className={styles.findingsHeader}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#f8fafc' }}>
              Vulnerability Findings ({report.findings.length})
            </span>
            <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleAddFinding}>
              <Plus size={13} /> Add Finding
            </button>
          </div>

          {/* Master-Detail Findings Workbench */}
          <div className={styles.findingsContainer}>
            {/* Left: Findings Master List */}
            <div className={styles.findingSidebar}>
              {report.findings.map((f) => {
                const isSelected = f.id === selectedFindingId;
                return (
                  <div
                    key={f.id}
                    className={styles.findingItem}
                    style={{
                      borderLeft: isSelected ? '3px solid #10b981' : '1px solid var(--card-border)',
                      background: isSelected ? 'rgba(16, 185, 129, 0.05)' : undefined,
                    }}
                    onClick={() => setSelectedFindingId(f.id)}
                  >
                    <div className={styles.findingTop}>
                      <span
                        className={`${styles.severityBadge} ${styles[f.severity] || ''}`}
                      >
                        {f.severity}
                      </span>
                      <span style={{ fontSize: '0.72rem', color: '#64748b' }}>{f.id}</span>
                    </div>
                    <div
                      style={{
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        color: isSelected ? '#f8fafc' : '#cbd5e1',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {f.title}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Right: Selected Finding Detail Form */}
            {selectedFinding && (
              <div className={styles.findingDetailForm}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.84rem', fontWeight: 700, color: '#f8fafc' }}>
                      {selectedFinding.id}
                    </span>
                    <button
                      className={styles.btn}
                      style={{ padding: '0.2rem 0.5rem', fontSize: '0.72rem' }}
                      onClick={() => setShowCvssCalculator(!showCvssCalculator)}
                    >
                      <Calculator size={11} /> CVSS: {selectedFinding.cvss?.score || 'N/A'} (
                      {selectedFinding.cvss?.severity.toUpperCase() || 'N/A'})
                    </button>
                  </div>
                  <button
                    className={styles.btn}
                    style={{ color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                    onClick={() => handleDeleteFinding(selectedFinding.id, selectedFinding.title)}
                  >
                    <Trash2 size={12} /> Delete
                  </button>
                </div>

                {showCvssCalculator && (
                  <div className={styles.cvssBox}>
                    <div style={{ fontSize: '0.74rem', color: '#10b981', fontFamily: 'monospace' }}>
                      Vector: {activeCvss.vectorString}
                    </div>

                    <div className={styles.cvssRow}>
                      <span>Attack Vector (AV)</span>
                      <div className={styles.cvssBtnGroup}>
                        {(['N', 'A', 'L', 'P'] as const).map((v) => (
                          <button
                            key={v}
                            className={`${styles.cvssOptionBtn} ${activeCvss.av === v ? styles.active : ''}`}
                            onClick={() => handleCvssMetricChange('av', v)}
                          >
                            {v}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className={styles.cvssRow}>
                      <span>Attack Complexity (AC)</span>
                      <div className={styles.cvssBtnGroup}>
                        {(['L', 'H'] as const).map((v) => (
                          <button
                            key={v}
                            className={`${styles.cvssOptionBtn} ${activeCvss.ac === v ? styles.active : ''}`}
                            onClick={() => handleCvssMetricChange('ac', v)}
                          >
                            {v}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className={styles.cvssRow}>
                      <span>Privileges Required (PR)</span>
                      <div className={styles.cvssBtnGroup}>
                        {(['N', 'L', 'H'] as const).map((v) => (
                          <button
                            key={v}
                            className={`${styles.cvssOptionBtn} ${activeCvss.pr === v ? styles.active : ''}`}
                            onClick={() => handleCvssMetricChange('pr', v)}
                          >
                            {v}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className={styles.cvssRow}>
                      <span>User Interaction (UI)</span>
                      <div className={styles.cvssBtnGroup}>
                        {(['N', 'R'] as const).map((v) => (
                          <button
                            key={v}
                            className={`${styles.cvssOptionBtn} ${activeCvss.ui === v ? styles.active : ''}`}
                            onClick={() => handleCvssMetricChange('ui', v)}
                          >
                            {v}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className={styles.cvssRow}>
                      <span>Scope (S)</span>
                      <div className={styles.cvssBtnGroup}>
                        {(['U', 'C'] as const).map((v) => (
                          <button
                            key={v}
                            className={`${styles.cvssOptionBtn} ${activeCvss.s === v ? styles.active : ''}`}
                            onClick={() => handleCvssMetricChange('s', v)}
                          >
                            {v}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className={styles.cvssRow}>
                      <span>Confidentiality (C)</span>
                      <div className={styles.cvssBtnGroup}>
                        {(['N', 'L', 'H'] as const).map((v) => (
                          <button
                            key={v}
                            className={`${styles.cvssOptionBtn} ${activeCvss.c === v ? styles.active : ''}`}
                            onClick={() => handleCvssMetricChange('c', v)}
                          >
                            {v}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className={styles.cvssRow}>
                      <span>Integrity (I)</span>
                      <div className={styles.cvssBtnGroup}>
                        {(['N', 'L', 'H'] as const).map((v) => (
                          <button
                            key={v}
                            className={`${styles.cvssOptionBtn} ${activeCvss.i === v ? styles.active : ''}`}
                            onClick={() => handleCvssMetricChange('i', v)}
                          >
                            {v}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className={styles.cvssRow}>
                      <span>Availability (A)</span>
                      <div className={styles.cvssBtnGroup}>
                        {(['N', 'L', 'H'] as const).map((v) => (
                          <button
                            key={v}
                            className={`${styles.cvssOptionBtn} ${activeCvss.a === v ? styles.active : ''}`}
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

                <div className={styles.formGroup} style={{ flex: 1, minHeight: 0 }}>
                  <label className={styles.label}>Vulnerability Description &amp; Impact</label>
                  <textarea
                    className={`${styles.textarea} ${styles.textareaGrow}`}
                    value={selectedFinding.description}
                    onChange={(e) =>
                      handleUpdateFinding(selectedFinding.id, { description: e.target.value })
                    }
                  />
                </div>

                <div className={styles.formGroup} style={{ flex: 1, minHeight: 0 }}>
                  <label className={styles.label}>Remediation Guidance</label>
                  <textarea
                    className={`${styles.textarea} ${styles.textareaGrow}`}
                    value={selectedFinding.remediation}
                    onChange={(e) =>
                      handleUpdateFinding(selectedFinding.id, { remediation: e.target.value })
                    }
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Markdown Preview Tab */}
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
              onClick={() =>
                handleDownload(
                  markdownContent,
                  `${report.title.toLowerCase().replace(/\s+/g, '_')}.md`,
                  'text/markdown'
                )
              }
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

      {/* Bug Bounty Preview Tab */}
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
                  badgeColor:
                    f.severity === 'critical'
                      ? '#ef4444'
                      : f.severity === 'high'
                      ? '#f97316'
                      : f.severity === 'medium'
                      ? '#fbbf24'
                      : '#10b981',
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

      {/* HTML / Print Preview Tab */}
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

      {/* Confirmation Modal */}
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
