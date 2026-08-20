import { useState, useEffect } from 'react';
import { CheckSquare, Filter, Sparkles, Check, X as XIcon, HelpCircle, RotateCcw } from 'lucide-react';
import type { SecurityChecklistItem } from '../../types';
import styles from './ChecklistTracker.module.css';

const DEFAULT_CHECKLIST: SecurityChecklistItem[] = [
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
];

const CHECKLIST_STORAGE_KEY = 'nexus_security_checklists';

interface ChecklistTrackerProps {
  onSendToAI?: (prompt: string) => void;
}

export default function ChecklistTracker({ onSendToAI }: ChecklistTrackerProps) {
  const [items, setItems] = useState<SecurityChecklistItem[]>(() => {
    try {
      const saved = localStorage.getItem(CHECKLIST_STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Failed to load checklist from localStorage:', e);
    }
    return DEFAULT_CHECKLIST;
  });

  const [filter, setFilter] = useState<'all' | 'untested' | 'pass' | 'fail'>('all');

  useEffect(() => {
    try {
      localStorage.setItem(CHECKLIST_STORAGE_KEY, JSON.stringify(items));
    } catch (e) {
      console.error('Failed to save checklist to localStorage:', e);
    }
  }, [items]);

  const handleStatusChange = (id: string, newStatus: SecurityChecklistItem['status']) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, status: newStatus } : it)));
  };

  const handleResetChecklist = () => {
    if (window.confirm('Reset checklist progress back to default?')) {
      setItems(DEFAULT_CHECKLIST);
    }
  };

  const total = items.length;
  const testedCount = items.filter((i) => i.status !== 'untested').length;
  const failCount = items.filter((i) => i.status === 'fail').length;
  const progressPercent = Math.round((testedCount / total) * 100);

  const filteredItems = items.filter((i) => {
    if (filter === 'all') return true;
    return i.status === filter;
  });

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

        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
          <button
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.35rem 0.7rem',
              borderRadius: '6px',
              fontSize: '0.75rem',
              fontWeight: 500,
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
            }}
            onClick={handleResetChecklist}
            title="Reset Checklist"
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
                fontWeight: 500,
                background: 'linear-gradient(135deg, #059669, #10b981)',
                border: 'none',
                color: 'white',
                cursor: 'pointer',
              }}
              onClick={() => {
                const fails = items.filter((i) => i.status === 'fail');
                if (fails.length === 0) {
                  onSendToAI('Recommend next test categories for an active web penetration test.');
                } else {
                  const summary = fails.map((f) => `- [FAIL] ${f.code}: ${f.title}`).join('\n');
                  onSendToAI(
                    `We have identified the following failed security controls:\n\n${summary}\n\nDraft a prioritized vulnerability remediation and exploit escalation guide for these issues.`
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
            Failed / Vuln ({failCount})
          </button>
        </div>
      </div>

      {/* Checklist Cards List */}
      <div className={styles.checkGrid}>
        {filteredItems.map((item) => (
          <div
            key={item.id}
            className={`${styles.checkCard} ${
              item.status === 'fail'
                ? styles.cardFail
                : item.status === 'pass'
                ? styles.cardPass
                : ''
            }`}
          >
            <div className={styles.cardHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span className={styles.codeBadge}>{item.code}</span>
                <span style={{ fontWeight: 600, fontSize: '0.84rem', color: '#f8fafc' }}>
                  {item.title}
                </span>
              </div>

              {/* Status Buttons */}
              <div className={styles.statusGroup}>
                <button
                  className={`${styles.statusBtn} ${item.status === 'pass' ? styles.passActive : ''}`}
                  onClick={() => handleStatusChange(item.id, 'pass')}
                >
                  PASS
                </button>
                <button
                  className={`${styles.statusBtn} ${item.status === 'fail' ? styles.failActive : ''}`}
                  onClick={() => handleStatusChange(item.id, 'fail')}
                >
                  FAIL
                </button>
                <button
                  className={`${styles.statusBtn} ${item.status === 'untested' ? styles.naActive : ''}`}
                  onClick={() => handleStatusChange(item.id, 'untested')}
                >
                  UNTESTED
                </button>
              </div>
            </div>

            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              {item.description}
            </span>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: '0.2rem',
              }}
            >
              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                {item.category}
              </span>
              {onSendToAI && (
                <button
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--accent-color)',
                    fontSize: '0.72rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                  }}
                  onClick={() =>
                    onSendToAI(
                      `Provide practical step-by-step testing instructions, payloads, and tool recommendations for: ${item.code} - ${item.title}`
                    )
                  }
                >
                  <Sparkles size={11} /> Guide Testing
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
