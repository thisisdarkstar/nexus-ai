import React from 'react';
import { Play, Sparkles, Trash2, Loader2 } from 'lucide-react';
import CustomSelect from '../../CustomSelect';
import { METHOD_OPTIONS, HTTP_PRESET_OPTIONS } from '../../../data/security/httpDefaultPresets';
import styles from '../HttpStudio.module.css';

interface RequestUrlBarProps {
  method: string;
  onChangeMethod: (method: string) => void;
  url: string;
  onChangeUrl: (url: string) => void;
  onSelectPreset: (presetKey: string) => void;
  onSendRequest: () => void;
  isSending: boolean;
  onClearAll: () => void;
  onSendToAI: () => void;
}

export default function RequestUrlBar({
  method,
  onChangeMethod,
  url,
  onChangeUrl,
  onSelectPreset,
  onSendRequest,
  isSending,
  onClearAll,
  onSendToAI,
}: RequestUrlBarProps) {
  return (
    <div className={styles.topBar}>
      <div className={styles.urlRow}>
        <CustomSelect
          value={method}
          options={METHOD_OPTIONS}
          onChange={onChangeMethod}
          style={{ width: '110px' }}
        />

        <CustomSelect
          value=""
          placeholder="⚡ Load Preset..."
          options={HTTP_PRESET_OPTIONS}
          onChange={onSelectPreset}
          style={{ width: '175px' }}
        />

        <input
          type="text"
          className={styles.urlInput}
          value={url}
          onChange={(e) => onChangeUrl(e.target.value)}
          placeholder="http://localhost:8080/api/v1/resource"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
              onSendRequest();
            }
          }}
        />

        <button
          className={`${styles.btn} ${styles.btnPrimary}`}
          onClick={onSendRequest}
          disabled={isSending}
          title="Execute HTTP Request (Ctrl+Enter)"
        >
          {isSending ? (
            <>
              <Loader2 size={13} className="animate-spin" /> Sending...
            </>
          ) : (
            <>
              <Play size={13} /> Send Request
            </>
          )}
        </button>

        <button
          className={styles.btn}
          onClick={onSendToAI}
          title="Send HTTP request & headers to AI for security flaw analysis"
        >
          <Sparkles size={13} /> AI Inspect
        </button>

        <button
          className={styles.btn}
          onClick={onClearAll}
          title="Clear request and response"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}
