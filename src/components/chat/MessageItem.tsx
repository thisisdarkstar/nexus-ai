import { useState, useEffect, useRef, memo } from 'react';
import {
  Copy,
  Check,
  Edit2,
  RotateCw,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Code2,
  Volume2,
  VolumeX,
  Sparkles,
  AlertTriangle,
  GitBranch,
  ShieldAlert,
} from 'lucide-react';
import { renderMarkdown } from '../../lib/markdown';
import { escapeHtml } from '../../lib/sanitize';
import type { Message, Settings, AvailableModel } from '../../types';
import styles from './MessageItem.module.css';

const COPY_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>';
const CHECK_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';

interface MessageItemProps {
  msg: Message;
  i: number;
  isGenerating: boolean;
  onEdit: (index: number) => void;
  onRegenerate: (index: number, provider?: string | null, modelId?: string | null) => void;
  onSwitchBranch: (messageIndex: number, direction: 'prev' | 'next') => void;
  onCopy: (text: string, index: number) => void;
  copiedIndex: number | null;
  onSpeak: (text: string, index: number) => void;
  isSpeaking: boolean;
  availableModels: AvailableModel[];
  settings: Settings;
}

function injectActionButtons(el: HTMLElement) {
  el.querySelectorAll('pre').forEach((pre) => {
    if (pre.querySelector('.code-action-bar')) return;
    const bar = document.createElement('div');
    bar.className = 'code-action-bar';

    const getCode = () => pre.querySelector('code')?.innerText || '';
    const getLang = () => {
      const codeEl = pre.querySelector('code');
      if (!codeEl) return '';
      const match = codeEl.className.match(/language-([a-zA-Z0-9_-]+)/);
      return match ? match[1].toLowerCase() : '';
    };

    // Sandbox button
    const sandBtn = document.createElement('button');
    sandBtn.className = 'code-action-btn';
    sandBtn.innerHTML = '🐍 Sandbox';
    sandBtn.title = 'Execute in isolated Pyodide Wasm sandbox';
    sandBtn.onclick = (e) => {
      e.stopPropagation();
      window.dispatchEvent(
        new CustomEvent('nexus:open-security', {
          detail: { tab: 'sandbox', code: getCode() },
        })
      );
      const prevText = sandBtn.innerHTML;
      sandBtn.innerHTML = '🐍 Opened';
      setTimeout(() => {
        sandBtn.innerHTML = prevText;
      }, 1500);
    };
    bar.appendChild(sandBtn);

    // Audit button
    const auditBtn = document.createElement('button');
    auditBtn.className = 'code-action-btn';
    auditBtn.innerHTML = '🛡️ Audit';
    auditBtn.title = 'Inspect in SAST Code Auditor';
    auditBtn.onclick = (e) => {
      e.stopPropagation();
      window.dispatchEvent(
        new CustomEvent('nexus:open-security', {
          detail: { tab: 'auditor', code: getCode(), language: getLang() },
        })
      );
      const prevText = auditBtn.innerHTML;
      auditBtn.innerHTML = '🛡️ Opened';
      setTimeout(() => {
        auditBtn.innerHTML = prevText;
      }, 1500);
    };
    bar.appendChild(auditBtn);

    // Decode button
    const decBtn = document.createElement('button');
    decBtn.className = 'code-action-btn';
    decBtn.innerHTML = '🔄 Decode';
    decBtn.title = 'Inspect in Decoders & JWT Hub';
    decBtn.onclick = (e) => {
      e.stopPropagation();
      window.dispatchEvent(
        new CustomEvent('nexus:open-security', {
          detail: { tab: 'decoders', input: getCode() },
        })
      );
      const prevText = decBtn.innerHTML;
      decBtn.innerHTML = '🔄 Opened';
      setTimeout(() => {
        decBtn.innerHTML = prevText;
      }, 1500);
    };
    bar.appendChild(decBtn);

    // Report button
    const repBtn = document.createElement('button');
    repBtn.className = 'code-action-btn';
    repBtn.innerHTML = '📑 Report';
    repBtn.title = 'Open in VAPT Report Studio';
    repBtn.onclick = (e) => {
      e.stopPropagation();
      window.dispatchEvent(
        new CustomEvent('nexus:open-security', {
          detail: { tab: 'reports', code: getCode() },
        })
      );
      const prevText = repBtn.innerHTML;
      repBtn.innerHTML = '📑 Opened';
      setTimeout(() => {
        repBtn.innerHTML = prevText;
      }, 1500);
    };
    bar.appendChild(repBtn);

    // Copy button
    const copyBtn = document.createElement('button');
    copyBtn.className = 'code-action-btn code-copy-btn';
    copyBtn.innerHTML = `${COPY_SVG} Copy`;
    copyBtn.onclick = (e) => {
      e.stopPropagation();
      navigator.clipboard.writeText(getCode());
      copyBtn.innerHTML = `${CHECK_SVG} Copied`;
      setTimeout(() => {
        copyBtn.innerHTML = `${COPY_SVG} Copy`;
      }, 2000);
    };
    bar.appendChild(copyBtn);

    pre.style.position = 'relative';
    pre.appendChild(bar);
  });
}

export default memo(function MessageItem({
  msg,
  i,
  isGenerating,
  onEdit,
  onRegenerate,
  onSwitchBranch,
  onCopy,
  copiedIndex,
  onSpeak,
  isSpeaking,
  availableModels,
  settings,
}: MessageItemProps) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const [showRaw, setShowRaw] = useState(false);
  const [showRetryMenu, setShowRetryMenu] = useState(false);
  const [renderKey, setRenderKey] = useState(0);

  // 1. Primary: run whenever content changes, raw is toggled, or renderKey bumped
  useEffect(() => {
    if (showRaw || !bodyRef.current) return;
    requestAnimationFrame(() => {
      if (bodyRef.current) injectActionButtons(bodyRef.current);
    });
  }, [msg.content, showRaw, renderKey]);

  // 2. MutationObserver: catches async/streamed markdown renders
  useEffect(() => {
    if (!bodyRef.current || showRaw) return;
    const observer = new MutationObserver(() => {
      if (bodyRef.current) injectActionButtons(bodyRef.current);
    });
    observer.observe(bodyRef.current, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [showRaw]);

  // 3. ResizeObserver: re-injects when the chat panel resizes (e.g. security
  //    workbench opens/closes → Virtuoso remounts items with unchanged
  //    msg.content, so effect 1 is skipped by React). injectActionButtons is
  //    idempotent — it checks for .code-action-bar before injecting.
  useEffect(() => {
    if (showRaw || !bodyRef.current) return;
    const ro = new ResizeObserver(() => {
      if (bodyRef.current) injectActionButtons(bodyRef.current);
    });
    ro.observe(bodyRef.current);
    return () => ro.disconnect();
  }, [showRaw]);

  const [importedSast, setImportedSast] = useState(false);

  const plainText = msg.content
    ? msg.content
        .replace(/[#*_`[\]()]/g, '')
        .replace(/\n/g, ' ')
        .trim()
    : '';
  const isUser = msg.role === 'user';

  const isSastReport =
    !isUser &&
    Boolean(
      msg.content &&
        (msg.content.includes('Static Application Security Testing') ||
          (msg.content.includes('Vulnerability Title') && msg.content.includes('CWE-')) ||
          msg.content.includes('Recommended Secure Remediation'))
    );

  const handleImportSast = () => {
    window.dispatchEvent(
      new CustomEvent('nexus:import-sast-finding', {
        detail: { content: msg.content },
      })
    );
    window.dispatchEvent(
      new CustomEvent('nexus:open-security', {
        detail: { tab: 'auditor' },
      })
    );
    setImportedSast(true);
    setTimeout(() => setImportedSast(false), 2500);
  };

  const retryOptions = [
    { label: 'Same model', provider: null, modelId: null },
    { label: 'Gemini Nano', provider: 'chrome', modelId: null },
    ...(availableModels || []).map((m) => ({
      label: m.id,
      provider: 'openai',
      modelId: m.id,
    })),
  ];

  return (
    <div className={`${styles.container} ${isUser ? styles.containerUser : styles.containerAi}`}>
      <div className={`${styles.bubble} ${isUser ? styles.bubbleUser : msg.error ? styles.bubbleError : styles.bubbleAi}`}>
        {msg.error ? (
          <div className={styles.errorContent}>
            <div className={styles.errorHeader}>
              <AlertTriangle size={16} />
              <span>Generation failed</span>
            </div>
            <div className={styles.errorMessage}>{msg.content}</div>
            <button
              onClick={() => onRegenerate(i)}
              className={styles.errorRetryBtn}
              title="Retry generation"
            >
              <RotateCw size={13} /> Retry
            </button>
          </div>
        ) : !isUser && msg.content && showRaw ? (
          <pre className={`message-body ${styles.rawContent}`}>{msg.content}</pre>
        ) : (
          <div
            ref={bodyRef}
            className="message-body"
            dangerouslySetInnerHTML={{
              __html:
                !isUser && msg.content
                  ? renderMarkdown(msg.content)
                  : !msg.content
                    ? '<span style="opacity:0.7; animation: pulse 2s infinite">Thinking...</span>'
                    : escapeHtml(msg.content).replace(/\n/g, '<br/>'),
            }}
          />
        )}
      </div>

      {msg.content && !msg.error && (
        <div className={styles.actions}>
          {isUser && !isGenerating && (
            <button onClick={() => onEdit(i)} className={styles.actionBtn} title="Edit message">
              <Edit2 size={14} /> Edit
            </button>
          )}

          {!isUser && !isGenerating && (
            <div className={styles.retryContainer}>
              <button
                onClick={() => onRegenerate(i)}
                className={styles.actionBtn}
                title="Regenerate response"
              >
                <RotateCw size={14} /> Regenerate
              </button>
              <button
                onClick={() => setShowRetryMenu((s) => !s)}
                className={styles.actionBtn}
                title="Retry with different model"
              >
                <ChevronDown size={12} />
              </button>

              {showRetryMenu && (
                <>
                  <div className={styles.retryBackdrop} onClick={() => setShowRetryMenu(false)} />
                  <div className={styles.retryMenu}>
                    <div className={styles.retryHeader}>Retry with</div>
                    {retryOptions.map((opt, idx) => {
                      const isCurrent =
                        settings &&
                        (opt.provider === null ||
                          (opt.provider === 'chrome' && settings.provider === 'chrome') ||
                          (opt.provider === 'openai' &&
                            settings.provider === 'openai' &&
                            settings.openaiModel === opt.modelId));
                      return (
                        <button
                          key={idx}
                          onClick={() => {
                            onRegenerate(i, opt.provider, opt.modelId);
                            setShowRetryMenu(false);
                          }}
                          className={styles.retryOption}
                        >
                          {opt.provider === 'chrome' ? (
                            <Sparkles size={12} color="var(--accent-color)" />
                          ) : (
                            <RotateCw size={12} />
                          )}
                          <span className={styles.retryLabel}>{opt.label}</span>
                          {isCurrent && <Check size={11} className={styles.retryCheck} />}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          <button
            onClick={() => onCopy(msg.content, i)}
            className={styles.actionBtn}
            title="Copy message"
          >
            {copiedIndex === i ? (
              <>
                <Check size={14} /> Copied
              </>
            ) : (
              <>
                <Copy size={14} /> Copy
              </>
            )}
          </button>

          {!isUser && !isGenerating && (
            <button
              onClick={() => setShowRaw((s) => !s)}
              className={showRaw ? styles.rawToggleActive : styles.rawToggle}
              title={showRaw ? 'Show rendered' : 'Show raw markdown'}
            >
              <Code2 size={14} /> {showRaw ? 'Rendered' : 'Source'}
            </button>
          )}

          {!isUser && onSpeak && (
            <button
              onClick={() => onSpeak(plainText, i)}
              className={isSpeaking ? styles.speakingBtn : styles.actionBtn}
              title={isSpeaking ? 'Stop speaking' : 'Speak message'}
            >
              {isSpeaking ? <VolumeX size={14} /> : <Volume2 size={14} />}
              {isSpeaking ? 'Stop' : 'Speak'}
            </button>
          )}

          {isSastReport && (
            <button
              onClick={handleImportSast}
              className={styles.actionBtn}
              style={{
                background: 'rgba(239, 68, 68, 0.15)',
                color: '#fca5a5',
                borderColor: 'rgba(239, 68, 68, 0.4)',
                fontWeight: 600,
              }}
              title="One-click import finding & remediation diff to SAST Auditor"
            >
              {importedSast ? (
                <>
                  <Check size={14} color="#10b981" /> Imported to Auditor!
                </>
              ) : (
                <>
                  <ShieldAlert size={14} color="#ef4444" /> 1-Click Import to Auditor
                </>
              )}
            </button>
          )}

          {(msg.generationTime || msg.createdAt || msg.tokens) && (
            <span className={styles.timestamp}>
              {msg.generationTime && (
                <>
                  <Clock size={12} /> {msg.generationTime}s{msg.createdAt || msg.tokens ? ' ·' : ''}
                </>
              )}
              {msg.tokens && (
                <>{msg.tokens.toLocaleString()} tok{msg.createdAt ? ' ·' : ''}</>
              )}
              {msg.createdAt &&
                new Date(msg.createdAt).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
            </span>
          )}
        </div>
      )}

      {!isUser && msg.branches && msg.branches.length > 0 && (
        <div className={styles.branchNav}>
          <button
            className={styles.branchBtn}
            onClick={() => onSwitchBranch(i, 'prev')}
            disabled={(msg.branchIndex ?? msg.branches.length) <= 0}
            title="Previous branch"
          >
            <ChevronLeft size={14} />
          </button>
          <span className={styles.branchInfo}>
            <GitBranch size={12} />
            {(msg.branchIndex ?? msg.branches.length) + 1} / {msg.branches.length + 1}
          </span>
          <button
            className={styles.branchBtn}
            onClick={() => onSwitchBranch(i, 'next')}
            disabled={(msg.branchIndex ?? msg.branches.length) >= msg.branches.length}
            title="Next branch"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
});
