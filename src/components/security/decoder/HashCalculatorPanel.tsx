import React, { useState } from 'react';
import {
  Hash,
  Search,
  Sparkles,
  Copy,
  Check,
} from 'lucide-react';
import type { IdentifiedHash } from '../../../lib/security/transformers';
import styles from '../DecoderHub.module.css';

interface HashCalculatorPanelProps {
  hashes: {
    md5: string;
    sha1: string;
    sha256: string;
    sha512: string;
  };
  identifiedHashes: IdentifiedHash[];
  onAuditWithAI: () => void;
}

export default function HashCalculatorPanel({
  hashes,
  identifiedHashes,
  onAuditWithAI,
}: HashCalculatorPanelProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  return (
    <div className={styles.toolCard}>
      <div className={styles.cardHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span className={styles.cardTitle}>
            <Hash size={16} color="#a855f7" /> Real-time Cryptographic Checksums &amp; Hash Identifier
          </span>
        </div>

        <button
          className={`${styles.btn} ${styles.btnPrimary}`}
          onClick={onAuditWithAI}
          title="Analyze hash in AI (identify algorithm, source database, and Hashcat modes)"
        >
          <Sparkles size={13} /> AI Hash Cracking Strategy
        </button>
      </div>

      {/* Real-time Hash Outputs */}
      <div className={styles.hashesGrid}>
        <div className={styles.hashRow}>
          <span className={styles.hashLabel}>MD5:</span>
          <code className={styles.hashCode}>{hashes.md5}</code>
          <button className={styles.btn} onClick={() => handleCopy('md5', hashes.md5)}>
            {copiedKey === 'md5' ? <Check size={11} color="#10b981" /> : <Copy size={11} />}
          </button>
        </div>

        <div className={styles.hashRow}>
          <span className={styles.hashLabel}>SHA-1:</span>
          <code className={styles.hashCode}>{hashes.sha1}</code>
          <button className={styles.btn} onClick={() => handleCopy('sha1', hashes.sha1)}>
            {copiedKey === 'sha1' ? <Check size={11} color="#10b981" /> : <Copy size={11} />}
          </button>
        </div>

        <div className={styles.hashRow}>
          <span className={styles.hashLabel}>SHA-256:</span>
          <code className={styles.hashCode}>{hashes.sha256}</code>
          <button className={styles.btn} onClick={() => handleCopy('sha256', hashes.sha256)}>
            {copiedKey === 'sha256' ? <Check size={11} color="#10b981" /> : <Copy size={11} />}
          </button>
        </div>

        <div className={styles.hashRow}>
          <span className={styles.hashLabel}>SHA-512:</span>
          <code className={styles.hashCode}>{hashes.sha512}</code>
          <button className={styles.btn} onClick={() => handleCopy('sha512', hashes.sha512)}>
            {copiedKey === 'sha512' ? <Check size={11} color="#10b981" /> : <Copy size={11} />}
          </button>
        </div>
      </div>

      {/* Hash Identifier Results */}
      {identifiedHashes.length > 0 && (
        <div className={styles.hashIdSection}>
          <div className={styles.hashIdHeader}>
            <Search size={14} color="#38bdf8" />
            <span>Possible Hash Identifications:</span>
          </div>

          <div className={styles.hashIdList}>
            {identifiedHashes.map((h, i) => (
              <div key={i} className={styles.hashIdCard}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className={styles.hashIdName}>{h.name}</span>
                  <div style={{ display: 'flex', gap: '0.3rem' }}>
                    <span className={styles.modeBadge}>Hashcat: {h.hashcatMode}</span>
                    <span className={styles.modeBadge}>John: {h.johnFormat}</span>
                  </div>
                </div>
                <p className={styles.hashIdDesc}>{h.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
