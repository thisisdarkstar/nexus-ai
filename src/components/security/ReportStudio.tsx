import { projectLocalStorage } from '../../core/storage/projectStorage';
import { eventBus } from '../../core/bus/EventBus';
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
  Eye,
  Code,
  GitBranch,
} from 'lucide-react';
import { workbenchBridge } from '../../lib/security/workbenchBridge';
import { calculateCVSS31, DEFAULT_CVSS } from '../../lib/security/cvss';
import {
  generateMarkdownReport,
  generateBugBountyMarkdown,
  generateHTMLReport,
  SAMPLE_VAPT_REPORT,
} from '../../lib/security/reportGenerator';
import { renderMarkdown } from '../../lib/markdown';
import { evidenceVault } from '../../domain/evidence/EvidenceVault';
import ConfirmModal from '../ConfirmModal';
import CustomSelect from '../common/CustomSelect';
import type { VAPTReport, VulnerabilityFinding, CVSSMetrics, VulnerabilitySeverity } from '../../types';
import CvssCalculator from './CvssCalculator';
import ReportPreviewPane from './ReportPreviewPane';
import styles from './ReportStudio.module.css';

const ASSESSMENT_TYPE_OPTIONS: Array<{ value: VAPTReport['assessmentType']; label: string }> = [
  { value: 'web', label: 'Web Application Pentest' },
  { value: 'api', label: 'API Security Assessment' },
  { value: 'mobile', label: 'Mobile Application Security' },
  { value: 'network', label: 'Network Infrastructure Pentest' },
  { value: 'cloud', label: 'Cloud Architecture Review' },
  { value: 'bug_bounty', label: 'Bug Bounty Engagement' },
];

const SEVERITY_LEVEL_OPTIONS: Array<{ value: VulnerabilitySeverity; label: string }> = [
  { value: 'critical', label: 'Critical' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
  { value: 'info', label: 'Informational' },
];

const REPORT_STORAGE_KEY = 'nexus_security_report';

interface ReportStudioProps {
  onSendToAI?: (prompt: string) => void;
}

export default function ReportStudio({ onSendToAI }: ReportStudioProps) {
  const [report, setReport] = useState<VAPTReport>(() => {
    try {
      const saved = projectLocalStorage.getItem(REPORT_STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Failed to load report from localStorage:', e);
    }
    return SAMPLE_VAPT_REPORT;
  });

  useEffect(() => {
    try {
      projectLocalStorage.setItem(REPORT_STORAGE_KEY, JSON.stringify(report));
    } catch (e) {
      console.error('Failed to save report to localStorage:', e);
    }
  }, [report]);

  useEffect(() => {
    return eventBus.subscribe('workbench:add-finding', (finding) => {
      setReport((prev) => {
        const exists = prev.findings.some(
          (f) => f.id === finding.id || f.title.toLowerCase() === finding.title.toLowerCase()
        );
        if (exists) {
          return {
            ...prev,
            findings: prev.findings.map((f) =>
              f.id === finding.id || f.title.toLowerCase() === finding.title.toLowerCase()
                ? { ...f, ...finding }
                : f
            ),
          };
        }
        return { ...prev, findings: [finding, ...prev.findings] };
      });
      setSelectedFindingId(finding.id);
    });
  }, []);

  const [subTab, setSubTab] = useState<'editor' | 'markdown' | 'bug_bounty' | 'html'>('editor');
  const [selectedFindingId, setSelectedFindingId] = useState<string | null>(
    report.findings[0]?.id || null
  );
  const [previewMode, setPreviewMode] = useState<'rendered' | 'raw'>('rendered');
  const [htmlTheme, setHtmlTheme] = useState<'dark' | 'light'>('dark');
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

  const markdownContent = generateMarkdownReport(report);
  const bugBountyContent = selectedFinding
    ? generateBugBountyMarkdown(selectedFinding, report.targetScope)
    : 'No finding selected';
  const htmlContent = generateHTMLReport(report, htmlTheme);

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
              <CustomSelect<VAPTReport['assessmentType']>
                value={report.assessmentType}
                onChange={(val) => setReport({ ...report, assessmentType: val })}
                options={ASSESSMENT_TYPE_OPTIONS}
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
                  className={`${styles.findingItem} ${selectedFindingId === f.id ? styles.findingItemActive : ''} ${styles[f.severity] || ''}`}
                >
                  <div className={styles.findingTop}>
                    <span className={`${styles.severityBadge} ${styles[f.severity]}`}>
                      {f.severity}
                    </span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{f.id}</span>
                  </div>
                  <span className={styles.findingTitleText}>
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
                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                    <button
                      className={styles.btn}
                      onClick={() => {
                        workbenchBridge.addNodeToMindmap({
                          text: selectedFinding.title,
                          tag: selectedFinding.severity.toUpperCase(),
                          notes: [
                            selectedFinding.targetEndpoint ? `Target: ${selectedFinding.targetEndpoint}` : '',
                            selectedFinding.description,
                          ]
                            .filter(Boolean)
                            .join('\n\n'),
                          accent:
                            selectedFinding.severity === 'critical' || selectedFinding.severity === 'high'
                              ? 'rose'
                              : selectedFinding.severity === 'medium'
                              ? 'amber'
                              : 'sky',
                        });
                        workbenchBridge.openNoteMap({ mode: 'mindmap' });
                      }}
                      title="Send this finding to Notes & Attack Mindmap"
                    >
                      <GitBranch size={13} /> + Mindmap
                    </button>
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
                  <CvssCalculator
                    metrics={activeCvss}
                    onMetricChange={handleCvssMetricChange}
                    onApply={handleApplyCvss}
                  />
                )}

                {/* Finding Title: Full width */}
                <div className={styles.formGroup}>
                  <label className={styles.label}>Finding Title</label>
                  <input
                    className={styles.input}
                    value={selectedFinding.title}
                    placeholder="e.g. Broken Object-Level Authorization (BOLA/IDOR) in Transaction Details API"
                    onChange={(e) =>
                      handleUpdateFinding(selectedFinding.id, { title: e.target.value })
                    }
                  />
                </div>

                {/* Severity, CWE & Target Endpoint Row */}
                <div className={styles.metaRow}>
                  <div className={styles.formGroup} style={{ flex: '1 1 150px' }}>
                    <label className={styles.label}>Severity Level</label>
                    <CustomSelect<VulnerabilitySeverity>
                      value={selectedFinding.severity}
                      onChange={(val) =>
                        handleUpdateFinding(selectedFinding.id, { severity: val })
                      }
                      options={SEVERITY_LEVEL_OPTIONS}
                    />
                  </div>
                  <div className={styles.formGroup} style={{ flex: '1 1 120px' }}>
                    <label className={styles.label}>CWE Identifier</label>
                    <input
                      className={styles.input}
                      value={selectedFinding.cweId || ''}
                      placeholder="e.g. CWE-639"
                      onChange={(e) =>
                        handleUpdateFinding(selectedFinding.id, { cweId: e.target.value })
                      }
                    />
                  </div>
                  <div className={styles.formGroup} style={{ flex: '2 1 240px' }}>
                    <label className={styles.label}>Target Endpoint / Asset</label>
                    <input
                      className={styles.input}
                      value={selectedFinding.targetEndpoint || ''}
                      placeholder="e.g. GET /api/v2/transactions/{id}"
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
                    value={selectedFinding.remediation}
                    onChange={(e) =>
                      handleUpdateFinding(selectedFinding.id, { remediation: e.target.value })
                    }
                  />
                </div>

                {/* Remediation Patch Diff */}
                <div className={styles.formGroup}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                    <label className={styles.label} style={{ margin: 0 }}>Remediation Patch Diff (Suggested Fix)</label>
                    {!selectedFinding.patchDiff && (
                      <button
                        type="button"
                        className={styles.btn}
                        style={{ padding: '0.2rem 0.5rem', fontSize: '0.72rem' }}
                        onClick={() =>
                          handleUpdateFinding(selectedFinding.id, {
                            patchDiff: {
                              original: '// Vulnerable code example',
                              patched: '// Secure remediated code example',
                            },
                          })
                        }
                      >
                        + Add Code Diff
                      </button>
                    )}
                  </div>

                  {selectedFinding.patchDiff && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
                      <div>
                        <span style={{ fontSize: '0.72rem', color: '#ef4444', fontWeight: 600 }}>Original (Insecure)</span>
                        <textarea
                          className={styles.textarea}
                          style={{ height: '90px', fontFamily: 'monospace', fontSize: '0.78rem' }}
                          value={selectedFinding.patchDiff.original}
                          onChange={(e) =>
                            handleUpdateFinding(selectedFinding.id, {
                              patchDiff: {
                                ...selectedFinding.patchDiff!,
                                original: e.target.value,
                              },
                            })
                          }
                        />
                      </div>
                      <div>
                        <span style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: 600 }}>Patched (Remediated)</span>
                        <textarea
                          className={styles.textarea}
                          style={{ height: '90px', fontFamily: 'monospace', fontSize: '0.78rem' }}
                          value={selectedFinding.patchDiff.patched}
                          onChange={(e) =>
                            handleUpdateFinding(selectedFinding.id, {
                              patchDiff: {
                                ...selectedFinding.patchDiff!,
                                patched: e.target.value,
                              },
                            })
                          }
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Evidence Integrity Hashes (SHA-256) */}
                <div className={styles.formGroup}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                    <label className={styles.label} style={{ margin: 0 }}>Cryptographic Evidence Hashes (SHA-256)</label>
                    <button
                      type="button"
                      className={styles.btn}
                      style={{ padding: '0.2rem 0.5rem', fontSize: '0.72rem' }}
                      onClick={async () => {
                        const snippet = prompt('Paste evidence snippet (HTTP trace, log, or code) to compute SHA-256:');
                        if (snippet) {
                          const hash = await evidenceVault.computeSha256(snippet);
                          const existing = selectedFinding.evidenceHashes || [];
                          if (!existing.includes(hash)) {
                            handleUpdateFinding(selectedFinding.id, {
                              evidenceHashes: [...existing, hash],
                            });
                          }
                        }
                      }}
                    >
                      + Hash & Attach Evidence
                    </button>
                  </div>
                  {selectedFinding.evidenceHashes && selectedFinding.evidenceHashes.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                      {selectedFinding.evidenceHashes.map((h, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.03)', padding: '0.3rem 0.6rem', borderRadius: '4px', fontSize: '0.76rem', fontFamily: 'monospace' }}>
                          <span style={{ color: '#10b981' }}>{h}</span>
                          <button
                            type="button"
                            style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 0 }}
                            onClick={() => {
                              handleUpdateFinding(selectedFinding.id, {
                                evidenceHashes: selectedFinding.evidenceHashes?.filter((_, idx) => idx !== i),
                              });
                            }}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #94a3b8)' }}>
                      No cryptographic evidence hashes attached yet.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {subTab === 'markdown' && (
        <ReportPreviewPane
          mode="markdown"
          previewMode={previewMode}
          onPreviewModeChange={setPreviewMode}
          content={markdownContent}
          copied={copied}
          onCopy={handleCopy}
          onDownload={handleDownload}
          downloadFilename={`${report.title.toLowerCase().replace(/\s+/g, '_')}.md`}
          findingCount={report.findings.length}
        />
      )}

      {subTab === 'bug_bounty' && (
        <ReportPreviewPane
          mode="bug_bounty"
          previewMode={previewMode}
          onPreviewModeChange={setPreviewMode}
          content={bugBountyContent}
          copied={copied}
          onCopy={handleCopy}
          onDownload={handleDownload}
          downloadFilename={`${(selectedFinding?.title || 'bounty_report').toLowerCase().replace(/\s+/g, '_')}.md`}
          findings={report.findings}
          selectedFindingId={selectedFindingId}
          onSelectFinding={setSelectedFindingId}
        />
      )}

      {subTab === 'html' && (
        <div className={styles.iframeContainer}>
          <div className={styles.copyRow}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <FileText size={14} color="#10b981" />
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                Executive VAPT Audit Report
              </span>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted, #94a3b8)' }}>
                (Self-contained HTML • Ready for A4 Print & PDF)
              </span>
            </div>
            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <div className={styles.viewToggle} role="group" aria-label="HTML Report Theme">
                <button
                  type="button"
                  className={`${styles.toggleBtn} ${htmlTheme === 'dark' ? styles.toggleBtnActive : ''}`}
                  onClick={() => setHtmlTheme('dark')}
                  title="Obsidian Dark PDF"
                >
                  Dark PDF
                </button>
                <button
                  type="button"
                  className={`${styles.toggleBtn} ${htmlTheme === 'light' ? styles.toggleBtnActive : ''}`}
                  onClick={() => setHtmlTheme('light')}
                  title="Light Paper PDF"
                >
                  Light
                </button>
              </div>
              <button
                className={styles.btn}
                onClick={() => {
                  const win = window.open('', '_blank');
                  if (win) {
                    win.document.write(htmlContent);
                    win.document.close();
                  }
                }}
                title="Open in a dedicated browser window"
              >
                <ExternalLink size={12} /> Open Fullpage
              </button>
              <button
                className={styles.btn}
                onClick={() =>
                  handleDownload(
                    htmlContent,
                    `${report.title.toLowerCase().replace(/\s+/g, '_')}.html`,
                    'text/html'
                  )
                }
                title="Download HTML file"
              >
                <Download size={12} /> Download HTML
              </button>
              <button
                className={`${styles.btn} ${styles.btnPrimary}`}
                onClick={() => {
                  const win = window.open('', '_blank');
                  if (win) {
                    win.document.write(htmlContent);
                    win.document.close();
                    win.focus();
                    setTimeout(() => win.print(), 350);
                  }
                }}
                title="Print or Save to PDF via system print dialog"
              >
                <Printer size={13} /> Print / Save PDF
              </button>
            </div>
          </div>
          <iframe
            srcDoc={htmlContent}
            className={styles.reportIframe}
            style={{ background: htmlTheme === 'light' ? '#ffffff' : '#020617' }}
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
