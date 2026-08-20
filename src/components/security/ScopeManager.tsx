import { useState, useEffect } from 'react';
import { Target, Plus, Trash2, Globe, Shield, Sparkles, AlertCircle, RotateCcw } from 'lucide-react';
import type { ScopeItem } from '../../types';
import styles from './ScopeManager.module.css';

const DEFAULT_SCOPE_ITEMS: ScopeItem[] = [
  {
    id: 'scope-1',
    target: '*.targetapp.com',
    type: 'domain',
    inScope: true,
    techStack: ['Web', 'API'],
    notes: 'Primary engagement domain and subdomains.',
    status: 'untested',
  },
];

const SCOPE_STORAGE_KEY = 'nexus_security_scope';

interface ScopeManagerProps {
  onSendToAI?: (prompt: string) => void;
}

export default function ScopeManager({ onSendToAI }: ScopeManagerProps) {
  const [scopeItems, setScopeItems] = useState<ScopeItem[]>(() => {
    try {
      const saved = localStorage.getItem(SCOPE_STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Failed to load scope from localStorage:', e);
    }
    return DEFAULT_SCOPE_ITEMS;
  });

  const [newTarget, setNewTarget] = useState('');
  const [newType, setNewType] = useState<ScopeItem['type']>('domain');
  const [isInScope, setIsInScope] = useState(true);

  useEffect(() => {
    try {
      localStorage.setItem(SCOPE_STORAGE_KEY, JSON.stringify(scopeItems));
    } catch (e) {
      console.error('Failed to save scope to localStorage:', e);
    }
  }, [scopeItems]);

  const handleAdd = () => {
    if (!newTarget.trim()) return;
    const newItem: ScopeItem = {
      id: `scope-${Date.now()}`,
      target: newTarget.trim(),
      type: newType,
      inScope: isInScope,
      techStack: ['Web'],
      notes: '',
      status: 'untested',
    };
    setScopeItems((prev) => [newItem, ...prev]);
    setNewTarget('');
  };

  const handleDelete = (id: string) => {
    setScopeItems((prev) => prev.filter((s) => s.id !== id));
  };

  const handleToggleScope = (id: string) => {
    setScopeItems((prev) =>
      prev.map((s) => (s.id === id ? { ...s, inScope: !s.inScope } : s))
    );
  };

  const handleResetDefaults = () => {
    if (window.confirm('Reset scope list back to sample targets?')) {
      setScopeItems(DEFAULT_SCOPE_ITEMS);
    }
  };

  const inScopeCount = scopeItems.filter((s) => s.inScope).length;
  const outScopeCount = scopeItems.filter((s) => !s.inScope).length;

  return (
    <div className={styles.scopeContainer}>
      {/* Header */}
      <div className={styles.topBar}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <Target size={16} color="var(--accent-color)" />
          <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Target Scope & Asset Matrix</span>
          <span style={{ fontSize: '0.75rem', color: '#10b981' }}>({inScopeCount} In-Scope)</span>
          <span style={{ fontSize: '0.75rem', color: '#ef4444' }}>({outScopeCount} Out-of-Scope)</span>
        </div>

        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
          <button
            className={styles.btn}
            onClick={handleResetDefaults}
            title="Reset Scope to Default"
          >
            <RotateCcw size={12} /> Reset
          </button>
          {onSendToAI && (
            <button
              className={`${styles.btn} ${styles.btnPrimary}`}
              onClick={() => {
                const inScopeList = scopeItems
                  .filter((s) => s.inScope)
                  .map((s) => `- ${s.target} [${s.techStack?.join(', ')}] : ${s.notes}`)
                  .join('\n');
                onSendToAI(
                  `Here is the active engagement target scope:\n\n${inScopeList}\n\nGenerate a prioritized Pentesting & Bug Bounty Attack Plan for these assets.`
                );
              }}
            >
              <Sparkles size={13} /> AI Attack Plan
            </button>
          )}
        </div>
      </div>

      {/* Target Asset Input Strip */}
      <div className={styles.inputStrip}>
        <input
          type="text"
          className={styles.input}
          placeholder="e.g. sub.target.com or 192.168.1.0/24"
          value={newTarget}
          onChange={(e) => setNewTarget(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
        />
        <select
          className={styles.select}
          value={newType}
          onChange={(e) => setNewType(e.target.value as ScopeItem['type'])}
        >
          <option value="domain">Domain / Host</option>
          <option value="api">REST / GraphQL API</option>
          <option value="ip">IP / CIDR Block</option>
          <option value="mobile">Mobile / Android App</option>
          <option value="cloud">Cloud Resource / S3</option>
        </select>
        <button
          className={styles.btn}
          onClick={() => setIsInScope(!isInScope)}
          style={{
            color: isInScope ? '#10b981' : '#ef4444',
            borderColor: isInScope ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)',
          }}
        >
          {isInScope ? 'In-Scope' : 'Out-of-Scope'}
        </button>
        <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleAdd}>
          <Plus size={13} /> Add Target
        </button>
      </div>

      {/* Target Asset Cards Grid */}
      {scopeItems.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
          No target assets in scope. Add a domain, IP range, or API endpoint above to begin mapping your engagement.
        </div>
      ) : (
        <div className={styles.scopeGrid}>
          {scopeItems.map((item) => (
          <div key={item.id} className={styles.scopeCard}>
            <div className={styles.scopeHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Globe size={14} color="var(--accent-color)" />
                <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{item.target}</span>
              </div>
              <button
                onClick={() => handleToggleScope(item.id)}
                className={item.inScope ? styles.inScopeBadge : styles.outScopeBadge}
                style={{ cursor: 'pointer', border: 'none' }}
                title="Click to toggle In-Scope / Out-of-Scope"
              >
                {item.inScope ? 'IN-SCOPE' : 'OUT-OF-SCOPE'}
              </button>
            </div>

            {item.notes && (
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                {item.notes}
              </span>
            )}

            {item.techStack && item.techStack.length > 0 && (
              <div className={styles.tagList}>
                {item.techStack.map((tech, i) => (
                  <span key={i} className={styles.tag}>
                    {tech}
                  </span>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.25rem' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                Status: <strong>{item.status.toUpperCase()}</strong>
              </span>
              <button
                onClick={() => handleDelete(item.id)}
                style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}
                title="Delete target"
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        ))}
      </div>
      )}
    </div>
  );
}
