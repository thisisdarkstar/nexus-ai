import { Check, Code, Copy, Download, Eye } from 'lucide-react';
import { renderMarkdown } from '../../lib/markdown';
import CustomSelect from '../common/CustomSelect';
import type { VulnerabilityFinding } from '../../types';
import styles from './ReportStudio.module.css';

interface ReportPreviewPaneProps {
  mode: 'markdown' | 'bug_bounty';
  previewMode: 'rendered' | 'raw';
  onPreviewModeChange: (mode: 'rendered' | 'raw') => void;
  content: string;
  copied: boolean;
  onCopy: (content: string) => void;
  onDownload: (content: string, filename: string, mimeType: string) => void;
  downloadFilename: string;
  findingCount?: number;
  findings?: VulnerabilityFinding[];
  selectedFindingId?: string | null;
  onSelectFinding?: (id: string) => void;
}

/**
 * Shared rendered/raw Markdown preview pane for full VAPT reports and single-finding bug bounty writeups.
 */
export default function ReportPreviewPane({
  mode,
  previewMode,
  onPreviewModeChange,
  content,
  copied,
  onCopy,
  onDownload,
  downloadFilename,
  findingCount = 0,
  findings = [],
  selectedFindingId,
  onSelectFinding,
}: ReportPreviewPaneProps) {
  const selectedFinding = findings.find((f) => f.id === selectedFindingId) || findings[0];
  const isBounty = mode === 'bug_bounty';

  return (
    <div className={styles.previewContainer}>
      <div className={isBounty ? styles.findingSelectorRow : styles.copyRow}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          {isBounty && onSelectFinding ? (
            <>
              <span style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-secondary, #94a3b8)' }}>
                Target Finding:
              </span>
              <CustomSelect
                value={selectedFindingId || ''}
                onChange={onSelectFinding}
                options={findings.map((f) => ({
                  value: f.id,
                  label: `[${f.id}] ${f.title} (${f.severity.toUpperCase()})`,
                }))}
                style={{ width: 'auto', minWidth: '240px', maxWidth: '380px' }}
              />
              {selectedFinding?.cvss && (
                <span className={`${styles.severityBadge} ${styles[selectedFinding.severity]}`}>
                  CVSS {selectedFinding.cvss.score} ({selectedFinding.cvss.severity.toUpperCase()})
                </span>
              )}
            </>
          ) : (
            <>
              <div className={styles.viewToggle}>
                <button
                  className={`${styles.toggleBtn} ${previewMode === 'rendered' ? styles.toggleBtnActive : ''}`}
                  onClick={() => onPreviewModeChange('rendered')}
                  title="Rendered Executive Document"
                >
                  <Eye size={12} /> Rendered View
                </button>
                <button
                  className={`${styles.toggleBtn} ${previewMode === 'raw' ? styles.toggleBtnActive : ''}`}
                  onClick={() => onPreviewModeChange('raw')}
                  title="Raw Markdown Syntax"
                >
                  <Code size={12} /> Raw Markdown
                </button>
              </div>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted, #94a3b8)' }}>
                {findingCount} findings • {content.split(/\s+/).filter(Boolean).length} words
              </span>
            </>
          )}
        </div>

        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {isBounty && (
            <div className={styles.viewToggle}>
              <button
                className={`${styles.toggleBtn} ${previewMode === 'rendered' ? styles.toggleBtnActive : ''}`}
                onClick={() => onPreviewModeChange('rendered')}
                title="Rendered Document"
              >
                <Eye size={12} /> Rendered
              </button>
              <button
                className={`${styles.toggleBtn} ${previewMode === 'raw' ? styles.toggleBtnActive : ''}`}
                onClick={() => onPreviewModeChange('raw')}
                title="Raw Markdown"
              >
                <Code size={12} /> Raw
              </button>
            </div>
          )}

          <button
            className={styles.btn}
            onClick={() => onCopy(content)}
            title={
              isBounty
                ? 'Copy HackerOne / Bugcrowd markdown to clipboard'
                : 'Copy markdown text to clipboard'
            }
          >
            {copied ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
            {copied ? 'Copied' : 'Copy'}
          </button>

          <button
            className={`${styles.btn} ${styles.btnPrimary}`}
            onClick={() => onDownload(content, downloadFilename, 'text/markdown')}
            title={isBounty ? 'Download Bug Bounty Report' : 'Download as Markdown file'}
          >
            <Download size={12} /> {isBounty ? 'Download' : 'Download .md'}
          </button>
        </div>
      </div>

      {previewMode === 'rendered' ? (
        <div
          className={styles.renderedContainer}
          dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
        />
      ) : (
        <textarea
          className={styles.previewCode}
          value={content}
          readOnly
          spellCheck={false}
        />
      )}
    </div>
  );
}
