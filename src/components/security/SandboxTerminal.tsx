import { useState, useEffect } from 'react';
import {
  Play,
  RotateCcw,
  Copy,
  Check,
  Terminal as TerminalIcon,
  Shield,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { usePyodide, SECURITY_SCRIPT_PRESETS } from '../../lib/sandbox/usePyodide';
import CustomSelect from '../CustomSelect';
import styles from './SandboxTerminal.module.css';

interface SandboxTerminalProps {
  initialCode?: string;
  /**
   * Changes whenever a new payload is dispatched, so re-opening the identical
   * snippet still re-applies it (React skips effects when values are equal).
   */
  initialCodeNonce?: number;
  onSendToAI?: (prompt: string) => void;
}

const SANDBOX_CODE_STORAGE_KEY = 'nexus_security_sandbox_code';

export default function SandboxTerminal({
  initialCode,
  initialCodeNonce,
  onSendToAI,
}: SandboxTerminalProps) {
  const {
    isReady,
    isInitializing,
    isExecuting,
    lastResult,
    executeCode,
    clearLogs,
    presets,
  } = usePyodide();

  const [code, setCode] = useState<string>(() => {
    if (initialCode) return initialCode;
    try {
      const saved = localStorage.getItem(SANDBOX_CODE_STORAGE_KEY);
      if (saved !== null) return saved;
    } catch {
      // fallback
    }
    return SECURITY_SCRIPT_PRESETS[0].code;
  });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(SANDBOX_CODE_STORAGE_KEY, code);
    } catch (e) {
      console.error('Failed to save sandbox code to localStorage:', e);
    }
  }, [code]);

  useEffect(() => {
    if (initialCode) {
      setCode(initialCode);
    }
    // initialCodeNonce forces re-apply even when initialCode is unchanged
  }, [initialCode, initialCodeNonce]);

  useEffect(() => {
    const handleSecurityEvent = (e: Event) => {
      const custom = e as CustomEvent<{ tab?: string; code?: string }>;
      if (custom.detail?.tab === 'sandbox' && custom.detail?.code) {
        setCode(custom.detail.code);
      }
    };
    window.addEventListener('nexus:open-security', handleSecurityEvent);
    return () => window.removeEventListener('nexus:open-security', handleSecurityEvent);
  }, []);

  const handleSelectPreset = (presetId: string) => {
    const selected = presets.find((p) => p.id === presetId);
    if (selected) {
      setCode(selected.code);
    }
  };

  const handleRun = async () => {
    if (!code.trim() || isExecuting) return;
    await executeCode(code);
  };

  const handleCopyOutput = () => {
    const output = `${lastResult.stdout}\n${lastResult.stderr}\n${lastResult.result || ''}`;
    navigator.clipboard.writeText(output.trim());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={styles.sandboxContainer}>
      {/* Top Controls Bar */}
      <div className={styles.topBar}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <CustomSelect
            value=""
            placeholder="Security Script Presets..."
            options={presets.map((p) => ({
              value: p.id,
              label: p.name,
              badge: p.category,
            }))}
            onChange={(val) => handleSelectPreset(val)}
            style={{ minWidth: '240px' }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {isInitializing ? (
            <span className={`${styles.statusIndicator} ${styles.loading}`}>
              <Loader2 size={12} className="animate-spin" /> Loading Pyodide...
            </span>
          ) : isReady ? (
            <span className={styles.statusIndicator}>
              <Shield size={12} /> Sandbox Ready (Pyodide Wasm)
            </span>
          ) : (
            <span className={`${styles.statusIndicator} ${styles.loading}`}>
              <Loader2 size={12} className="animate-spin" /> Initializing Sandbox...
            </span>
          )}
        </div>
      </div>

      {/* Python Code Input Area */}
      <div className={styles.editorArea}>
        <div className={styles.editorHeader}>
          <span>🐍 Python 3.12 (Isolated In-Browser Execution)</span>
          <span style={{ fontSize: '0.7rem' }}>Ctrl+Enter to Execute</span>
        </div>
        <textarea
          className={styles.codeTextarea}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
              e.preventDefault();
              handleRun();
            }
          }}
          placeholder="# Write Python code or select a security preset above..."
          spellCheck={false}
        />
      </div>

      {/* Actions */}
      <div className={styles.actionRow}>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            className={`${styles.btn} ${styles.btnPrimary}`}
            onClick={handleRun}
            disabled={isExecuting}
          >
            {isExecuting ? (
              <>
                <Loader2 size={14} className="animate-spin" /> Executing Script...
              </>
            ) : (
              <>
                <Play size={14} /> Run in Sandbox
              </>
            )}
          </button>
          <button
            className={styles.btn}
            onClick={() => setCode('')}
            title="Clear code editor"
          >
            <RotateCcw size={13} /> Clear Code
          </button>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {onSendToAI && lastResult.status !== 'idle' && (
            <button
              className={styles.btn}
              onClick={() =>
                onSendToAI(
                  `Here is the script output from my Pyodide security sandbox:\n\`\`\`python\n${code}\n\`\`\`\n\nOutput:\n\`\`\`\n${lastResult.stdout}\n${lastResult.stderr}\n${lastResult.result || ''}\n\`\`\`\nPlease analyze this result.`
                )
              }
            >
              <Sparkles size={13} /> Analyze Output with AI
            </button>
          )}
        </div>
      </div>

      {/* Terminal Output Screen */}
      <div className={styles.terminalView}>
        <div className={styles.terminalHeader}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <TerminalIcon size={14} /> Sandbox Console Output
            {lastResult.executionTimeMs > 0 && (
              <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>
                ({lastResult.executionTimeMs}ms)
              </span>
            )}
          </span>
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <button
              className={styles.btn}
              style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }}
              onClick={handleCopyOutput}
              title="Copy Output"
            >
              {copied ? <Check size={11} /> : <Copy size={11} />}
            </button>
            <button
              className={styles.btn}
              style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }}
              onClick={clearLogs}
              title="Clear Terminal"
            >
              Clear
            </button>
          </div>
        </div>

        <div className={styles.terminalOutput}>
          {lastResult.status === 'idle' ? (
            <span style={{ color: 'var(--text-muted)' }}>
              [+] Pyodide WebAssembly runtime ready. Click "Run in Sandbox" to execute.
            </span>
          ) : (
            <>
              {lastResult.stdout && (
                <div className={styles.terminalStdout}>{lastResult.stdout}</div>
              )}
              {lastResult.stderr && (
                <div className={styles.terminalStderr}>[ERROR] {lastResult.stderr}</div>
              )}
              {lastResult.result && (
                <div className={styles.terminalResult}>
                  [Return Value]: {lastResult.result}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
