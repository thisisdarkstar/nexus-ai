import React from 'react';
import { Copy, Check, Sparkles, Terminal } from 'lucide-react';
import type { PayloadItem } from '../../../data/security/payloadCatalog';
import styles from '../PayloadCrafter.module.css';

interface PayloadCardProps {
  item: PayloadItem;
  encodedPayload: string;
  isCopied: boolean;
  onCopy: (id: string, text: string) => void;
  onSendToAI: (prompt: string) => void;
  onSendToSandbox?: (code: string) => void;
}

export default function PayloadCard({
  item,
  encodedPayload,
  isCopied,
  onCopy,
  onSendToAI,
  onSendToSandbox,
}: PayloadCardProps) {
  const handleAIAnalyze = () => {
    const prompt = `I am analyzing the following security payload (${item.name} / ${item.tags}):\n\n\`\`\`\n${encodedPayload}\n\`\`\`\n\nExplain how this payload works, what vulnerabilities it targets, potential WAF bypass variations, and defensive remediation strategies.`;
    onSendToAI(prompt);
  };

  return (
    <div className={styles.payloadCard}>
      <div className={styles.cardHeader}>
        <div className={styles.cardInfo}>
          <span className={styles.cardTitle}>{item.name}</span>
          <span className={styles.cardTag}>{item.tags}</span>
        </div>

        <div className={styles.cardActions}>
          <button
            className={styles.actionBtn}
            onClick={() => onCopy(item.id, encodedPayload)}
            title="Copy Encoded Payload"
          >
            {isCopied ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
            <span>{isCopied ? 'Copied!' : 'Copy'}</span>
          </button>

          {onSendToSandbox && (
            <button
              className={styles.actionBtn}
              onClick={() => onSendToSandbox(encodedPayload)}
              title="Test in Sandbox Terminal"
            >
              <Terminal size={14} />
              <span>Sandbox</span>
            </button>
          )}

          <button
            className={styles.actionBtnAi}
            onClick={handleAIAnalyze}
            title="AI Exploit & Defense Analysis"
          >
            <Sparkles size={14} />
            <span>AI Analyze</span>
          </button>
        </div>
      </div>

      <div className={styles.codeBlockWrapper}>
        <pre className={styles.codeBlock}>
          <code>{encodedPayload}</code>
        </pre>
      </div>
    </div>
  );
}
