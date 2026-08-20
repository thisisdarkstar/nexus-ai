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
import styles from './SandboxTerminal.module.css';

interface SandboxTerminalProps {
  initialCode?: string;
  onSendToAI?: (prompt: string) => void;
}

export default function SandboxTerminal({
  initialCode,
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

  const [code, setCode] = useState(initialCode || SECURITY_SCRIPT_PRESETS[0].code);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (initialCode) {
      setCode(initialCode);
    }
  }, [initialCode]);

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
          <select
            className={styles.presetSelect}
            onChange={(e) => handleSelectPreset(e.target.value)}
            defaultValue={SECURITY_SCRIPT_PRESETS[0].id}
          >
            <option disabled>-- Security Script Presets --</option>
            {presets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.category})
              </option>
            ))}
          </select>
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
