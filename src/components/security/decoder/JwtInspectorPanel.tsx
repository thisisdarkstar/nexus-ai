import React, { useState } from 'react';
import {
  Key,
  ShieldAlert,
  Sparkles,
  Copy,
  Check,
} from 'lucide-react';
import type { DecodedJWT } from '../../../types';
import styles from '../DecoderHub.module.css';

interface JwtInspectorPanelProps {
  jwt: DecodedJWT | null;
  onAuditWithAI: () => void;
}

export default function JwtInspectorPanel({ jwt, onAuditWithAI }: JwtInspectorPanelProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!jwt) {
    return (
      <div className={styles.toolCard}>
        <div className={styles.cardHeader}>
          <span className={styles.cardTitle}>
            <Key size={16} color="#fbbf24" /> JWT (JSON Web Token) Live Inspector &amp; Claims Parser
          </span>
        </div>
        <div className={styles.emptyState}>
          <span>Paste a valid JWT token (header.payload.signature) into the input box to parse claims.</span>
        </div>
      </div>
    );
  }

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  const isAlgNone = jwt.algorithm?.toLowerCase() === 'none';

  return (
    <div className={styles.toolCard}>
      <div className={styles.cardHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span className={styles.cardTitle}>
            <Key size={16} color="#fbbf24" /> JWT Live Inspector &amp; Claims Parser
          </span>
          <span className={`${styles.cardBadge} ${isAlgNone ? styles.cardBadgeRed : styles.cardBadgeGreen}`}>
            Alg: {jwt.algorithm}
          </span>
          <span className={`${styles.cardBadge} ${jwt.isExpired ? styles.cardBadgeRed : styles.cardBadgeGreen}`}>
            {jwt.isExpired ? 'Expired' : 'Active Token'}
          </span>
        </div>

        <button
          className={`${styles.btn} ${styles.btnPrimary}`}
          onClick={onAuditWithAI}
          title="Audit token for algorithm confusion, none bypass, and privilege escalation"
        >
          <Sparkles size={13} /> AI JWT Audit
        </button>
      </div>

      {isAlgNone && (
        <div className={styles.alertWarning}>
          <ShieldAlert size={15} color="#ef4444" />
          <span>Vulnerability Detected: Algorithm is &quot;none&quot; — signature validation can be bypassed!</span>
        </div>
      )}

      <div className={styles.jwtPanesGrid}>
        {/* Header */}
        <div className={styles.jwtColumn}>
          <div className={styles.jwtColumnHeader}>
            <span style={{ color: '#ef4444', fontWeight: 600 }}>1. Header (Algorithm &amp; Type)</span>
            <button
              className={styles.btn}
              onClick={() => handleCopy('header', JSON.stringify(jwt.header, null, 2))}
            >
              {copiedKey === 'header' ? <Check size={11} color="#10b981" /> : <Copy size={11} />}
            </button>
          </div>
          <pre className={styles.jsonPre}>
            <code>{JSON.stringify(jwt.header, null, 2)}</code>
          </pre>
        </div>

        {/* Payload */}
        <div className={styles.jwtColumn}>
          <div className={styles.jwtColumnHeader}>
            <span style={{ color: '#a855f7', fontWeight: 600 }}>2. Payload (Claims &amp; Data)</span>
            <button
              className={styles.btn}
              onClick={() => handleCopy('payload', JSON.stringify(jwt.payload, null, 2))}
            >
              {copiedKey === 'payload' ? <Check size={11} color="#10b981" /> : <Copy size={11} />}
            </button>
          </div>
          <pre className={styles.jsonPre}>
            <code>{JSON.stringify(jwt.payload, null, 2)}</code>
          </pre>
        </div>

        {/* Signature */}
        <div className={styles.jwtColumn}>
          <div className={styles.jwtColumnHeader}>
            <span style={{ color: '#38bdf8', fontWeight: 600 }}>3. Signature</span>
            <button
              className={styles.btn}
              onClick={() => handleCopy('sig', jwt.signature || '')}
            >
              {copiedKey === 'sig' ? <Check size={11} color="#10b981" /> : <Copy size={11} />}
            </button>
          </div>
          <div className={styles.signatureBox}>
            <code>{jwt.signature || '(Unsigned token)'}</code>
          </div>
        </div>
      </div>
    </div>
  );
}
