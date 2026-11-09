import { useState, useMemo } from 'react';
import {
  BookOpen,
  Search,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  Sparkles,
  PlusCircle,
  FileCode,
  CheckCircle,
} from 'lucide-react';
import {
  KNOWLEDGE_BASE_ENTRIES,
  type KnowledgeBaseEntry,
} from '../../domain/knowledge/KnowledgeBaseData';
import { eventBus } from '../../core/bus/EventBus';
import styles from './KnowledgeBase.module.css';

interface KnowledgeBaseProps {
  onSendToAI?: (prompt: string) => void;
}

export default function KnowledgeBase({ onSendToAI }: KnowledgeBaseProps) {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('ALL');
  const [selectedEntryId, setSelectedEntryId] = useState<string>(
    KNOWLEDGE_BASE_ENTRIES[0]?.id || 'CWE-89'
  );

  const categories = useMemo(() => {
    const cats = new Set(KNOWLEDGE_BASE_ENTRIES.map((e) => e.category));
    return ['ALL', ...Array.from(cats)];
  }, []);

  const filteredEntries = useMemo(() => {
    return KNOWLEDGE_BASE_ENTRIES.filter((entry) => {
      if (selectedCategory !== 'ALL' && entry.category !== selectedCategory) return false;
      if (selectedSeverity !== 'ALL' && entry.severity !== selectedSeverity) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesId = entry.id.toLowerCase().includes(q);
        const matchesName = entry.name.toLowerCase().includes(q);
        const matchesSummary = entry.summary.toLowerCase().includes(q);
        const matchesOwasp = entry.owaspCategory.toLowerCase().includes(q);
        if (!matchesId && !matchesName && !matchesSummary && !matchesOwasp) return false;
      }
      return true;
    });
  }, [searchQuery, selectedCategory, selectedSeverity]);

  const selectedEntry = useMemo(() => {
    return (
      KNOWLEDGE_BASE_ENTRIES.find((e) => e.id === selectedEntryId) ||
      filteredEntries[0] ||
      KNOWLEDGE_BASE_ENTRIES[0]
    );
  }, [selectedEntryId, filteredEntries]);

  const handleFileFindingTemplate = (entry: KnowledgeBaseEntry) => {
    eventBus.publish('finding:added', {
      finding: {
        id: `FIND-${entry.id}-${Date.now()}`,
        title: `${entry.name} (${entry.id})`,
        severity: entry.severity,
        cweId: entry.id,
        owaspCategory: entry.owaspCategory,
        description: `${entry.summary}\n\nTechnical Mechanics:\n${entry.mechanics}`,
        remediation: entry.defensiveControls.map((c) => `- ${c}`).join('\n'),
        patchDiff: {
          original: entry.codeSample.vulnerable,
          patched: entry.codeSample.secure,
        },
        references: entry.references,
        status: 'open',
      },
    });
    alert(`Added '${entry.name}' vulnerability finding template to Report Studio!`);
  };

  const handleSendToAIForReview = (entry: KnowledgeBaseEntry) => {
    if (!onSendToAI) return;
    const prompt = `As a Defensive Application Security Architect, provide a tailored security evaluation for ${entry.name} (${entry.id}):

OWASP Category: ${entry.owaspCategory}
Severity: ${entry.severity.toUpperCase()}

Vulnerability Summary:
${entry.summary}

Common Attack Vectors:
${entry.attackVectors.map((v) => `- ${v}`).join('\n')}

Defensive Controls:
${entry.defensiveControls.map((c) => `- ${c}`).join('\n')}

Please provide:
1. Architectural threat model and root-cause defense-in-depth principles.
2. Automated SAST/DAST verification rule strategy for CI/CD pipelines.
3. Code remediation pattern review for ${entry.codeSample.language}.`;
    onSendToAI(prompt);
  };

  return (
    <div className={styles.container}>
      {/* Top Header */}
      <div className={styles.header}>
        <div className={styles.titleArea}>
          <BookOpen size={28} className={styles.titleIcon} />
          <div>
            <h2 className={styles.title}>CWE & OWASP Security Knowledge Base</h2>
            <p className={styles.subtitle}>
              Offline technical encyclopedia of software weaknesses, attack mechanics & verified defensive patterns
            </p>
          </div>
        </div>

        <div className={styles.actions}>
          {onSendToAI && selectedEntry && (
            <button
              type="button"
              className={styles.btn}
              onClick={() => handleSendToAIForReview(selectedEntry)}
            >
              <Sparkles size={14} color="#10b981" /> AI Defensive Blueprint
            </button>
          )}
        </div>
      </div>

      {/* Split Explorer Layout */}
      <div className={styles.explorerLayout}>
        {/* Left: Filterable List Panel */}
        <div className={styles.listPanel}>
          <div className={styles.filterRow}>
            <input
              className={styles.searchBox}
              placeholder="Search weaknesses (CWE-89, SQLi, SSRF, Auth)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <select
              className={styles.searchBox}
              style={{ flex: 'none', width: '110px' }}
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <select
              className={styles.searchBox}
              style={{ flex: 'none', width: '90px' }}
              value={selectedSeverity}
              onChange={(e) => setSelectedSeverity(e.target.value)}
            >
              <option value="ALL">All Sev</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
            </select>
          </div>

          <div className={styles.entryList}>
            {filteredEntries.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8', fontSize: '0.8rem' }}>
                No weaknesses match active filters.
              </div>
            ) : (
              filteredEntries.map((entry) => {
                const isActive = selectedEntry?.id === entry.id;
                const sevClass =
                  entry.severity === 'critical'
                    ? styles.sevCritical
                    : entry.severity === 'high'
                      ? styles.sevHigh
                      : entry.severity === 'medium'
                        ? styles.sevMedium
                        : styles.sevLow;

                return (
                  <div
                    key={entry.id}
                    className={`${styles.entryCard} ${isActive ? styles.entryCardActive : ''}`}
                    onClick={() => setSelectedEntryId(entry.id)}
                  >
                    <div className={styles.entryHeader}>
                      <span className={styles.cweBadge}>{entry.id}</span>
                      <span className={`${styles.severityPill} ${sevClass}`}>{entry.severity}</span>
                    </div>
                    <span className={styles.entryName}>{entry.name}</span>
                    <div className={styles.entryMeta}>
                      <span>{entry.category}</span>
                      <span>•</span>
                      <span>{entry.owaspCategory.split('-')[0]}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Comprehensive Entry Detail Panel */}
        {selectedEntry ? (
          <div className={styles.detailPanel}>
            <div className={styles.detailTop}>
              <div>
                <h3 className={styles.detailTitle}>{selectedEntry.name}</h3>
                <div className={styles.tagRow}>
                  <span className={styles.cweBadge}>{selectedEntry.id}</span>
                  <span
                    className={`${styles.severityPill} ${
                      selectedEntry.severity === 'critical'
                        ? styles.sevCritical
                        : selectedEntry.severity === 'high'
                          ? styles.sevHigh
                          : selectedEntry.severity === 'medium'
                            ? styles.sevMedium
                            : styles.sevLow
                    }`}
                  >
                    {selectedEntry.severity.toUpperCase()}
                  </span>
                  <span className={styles.tag}>{selectedEntry.category}</span>
                  <span className={styles.tag}>{selectedEntry.owaspCategory}</span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnPrimary}`}
                  onClick={() => handleFileFindingTemplate(selectedEntry)}
                  title="File this weakness template as a finding in Report Studio"
                >
                  <PlusCircle size={14} /> File Template
                </button>
                {onSendToAI && (
                  <button
                    type="button"
                    className={styles.btn}
                    onClick={() => handleSendToAIForReview(selectedEntry)}
                  >
                    <Sparkles size={14} color="#10b981" /> AI Review
                  </button>
                )}
              </div>
            </div>

            {/* Vulnerability Overview */}
            <div className={styles.section}>
              <span className={styles.sectionTitle}>Vulnerability Overview & Impact</span>
              <p className={styles.prose}>{selectedEntry.summary}</p>
            </div>

            {/* Technical Mechanics */}
            <div className={styles.section}>
              <span className={styles.sectionTitle}>Technical Mechanics & Root Cause</span>
              <p className={styles.prose}>{selectedEntry.mechanics}</p>
            </div>

            {/* Attack Vectors */}
            <div className={styles.section}>
              <span className={styles.sectionTitle}>Common Attack Vectors</span>
              <div className={styles.vectorCard}>
                {selectedEntry.attackVectors.map((v, idx) => (
                  <div key={idx} className={styles.vectorItem}>
                    <AlertTriangle size={13} style={{ flexShrink: 0 }} />
                    <span>{v}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Defensive Controls & Hardening */}
            <div className={styles.section}>
              <span className={styles.sectionTitle}>Defensive Controls & Hardening</span>
              <div className={styles.controlCard}>
                {selectedEntry.defensiveControls.map((c, idx) => (
                  <div key={idx} className={styles.controlItem}>
                    <CheckCircle size={13} style={{ flexShrink: 0 }} />
                    <span>{c}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Code Comparison */}
            <div className={styles.section}>
              <span className={styles.sectionTitle}>
                Implementation Comparison ({selectedEntry.codeSample.language})
              </span>
              <div className={styles.codeGrid}>
                <div className={styles.codeBox}>
                  <div className={`${styles.codeBoxHeader} ${styles.codeBoxInsecure}`}>
                    <span>Vulnerable Pattern</span>
                  </div>
                  <pre className={styles.codePre}>
                    <code>{selectedEntry.codeSample.vulnerable}</code>
                  </pre>
                </div>
                <div className={styles.codeBox}>
                  <div className={`${styles.codeBoxHeader} ${styles.codeBoxSecure}`}>
                    <span>Remediated Pattern</span>
                  </div>
                  <pre className={styles.codePre}>
                    <code>{selectedEntry.codeSample.secure}</code>
                  </pre>
                </div>
              </div>
            </div>

            {/* References */}
            <div className={styles.section}>
              <span className={styles.sectionTitle}>Authoritative References</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                {selectedEntry.references.map((r, i) => (
                  <a
                    key={i}
                    href={r}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      fontSize: '0.78rem',
                      color: '#38bdf8',
                      textDecoration: 'none',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                    }}
                  >
                    <ExternalLink size={12} /> {r}
                  </a>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
            Select a weakness entry to view encyclopedia details.
          </div>
        )}
      </div>
    </div>
  );
}
