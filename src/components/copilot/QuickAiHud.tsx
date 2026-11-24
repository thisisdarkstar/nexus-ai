import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Send,
  X,
  Square,
  Copy,
  Check,
  Maximize2,
  ShieldAlert,
  Binary,
  Code,
  FileCheck,
} from 'lucide-react';
import { providerManager } from '../../lib/providers/ProviderManager';
import { renderMarkdown } from '../../lib/markdown';
import type { Settings } from '../../types';
import styles from './QuickAiHud.module.css';

interface QuickAiHudProps {
  isOpen: boolean;
  onClose: () => void;
  settings: Settings;
  onOpenFullCopilotWithPrompt: (prompt: string, initialResponse?: string) => void;
  initialQuery?: string;
}

const QUICK_TOPIC_CHIPS = [
  { label: 'Explain Vulnerability', prefix: 'Explain this security vulnerability and its attack vector: ' },
  { label: 'Deobfuscate / Decode', prefix: 'Deobfuscate and analyze the malicious intent of this payload: ' },
  { label: 'Generate PoC', prefix: 'Write a non-destructive verification proof-of-concept for: ' },
  { label: 'Remediation Fix', prefix: 'Provide secure code remediation and config hardening for: ' },
];

export default function QuickAiHud({
  isOpen,
  onClose,
  settings,
  onOpenFullCopilotWithPrompt,
  initialQuery = '',
}: QuickAiHudProps) {
  const [query, setQuery] = useState(initialQuery);
  const [response, setResponse] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (initialQuery) setQuery(initialQuery);
      setResponse('');
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      if (abortRef.current) abortRef.current.abort();
      setIsStreaming(false);
    }
  }, [isOpen, initialQuery]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleSend = async (overridePrompt?: string) => {
    const promptToSend = (overridePrompt !== undefined ? overridePrompt : query).trim();
    if (!promptToSend || isStreaming) return;

    abortRef.current = new AbortController();
    setIsStreaming(true);
    setResponse('');

    const provider = providerManager.getProvider();
    if (!provider) {
      setResponse('AI Provider unavailable. Check settings.');
      setIsStreaming(false);
      return;
    }

    try {
      const stream = provider.streamPrompt(
        [{ role: 'user', content: promptToSend }],
        settings.systemPrompt,
        abortRef.current.signal,
        {
          temperature: settings.temperature,
          maxTokens: settings.maxTokens,
          contextWindow: settings.contextWindow,
          topP: settings.topP,
          topK: settings.topK,
          repeatPenalty: settings.repeatPenalty,
        }
      );

      let accumulated = '';
      for await (const delta of stream) {
        accumulated += delta;
        setResponse(accumulated);
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setResponse(`Error: ${err.message || 'Failed to stream response'}`);
      }
    } finally {
      setIsStreaming(false);
    }
  };

  const handleStop = () => {
    if (abortRef.current) abortRef.current.abort();
    setIsStreaming(false);
  };

  const handleChipClick = (prefix: string) => {
    setQuery(prefix);
    inputRef.current?.focus();
  };

  const handleContinueInCopilot = () => {
    onOpenFullCopilotWithPrompt(query, response);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className={styles.hudOverlay} onClick={onClose}>
      <div
        className={styles.hudCard}
        role="dialog"
        aria-modal="true"
        aria-label="Quick AI Spotlight"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Input Bar */}
        <div className={styles.hudInputRow}>
          <Sparkles size={18} className={styles.hudInputIcon} />
          <input
            ref={inputRef}
            type="text"
            className={styles.hudInput}
            placeholder="Ask AI anything (e.g. Decode base64, explain CVE-2023-38606, write regex)..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void handleSend();
              }
            }}
          />
          <span className={styles.hudEscBadge}>ESC</span>
          <button
            type="button"
            className={styles.hudActionBtn}
            onClick={onClose}
            aria-label="Close"
          >
            <X size={15} />
          </button>
        </div>

        {/* Quick Topic Chips */}
        <div className={styles.hudChipsRow}>
          {QUICK_TOPIC_CHIPS.map((chip, idx) => (
            <button
              key={idx}
              type="button"
              className={styles.hudChip}
              onClick={() => handleChipClick(chip.prefix)}
            >
              <span>{chip.label}</span>
            </button>
          ))}
        </div>

        {/* Streaming Response Body */}
        {(response || isStreaming) && (
          <div className={styles.hudResponseBody}>
            <div dangerouslySetInnerHTML={{ __html: renderMarkdown(response) }} />
          </div>
        )}

        {/* Footer */}
        <div className={styles.hudFooter}>
          <div className={styles.hudModelBadge}>
            <Sparkles size={11} color="#38bdf8" />
            <span>{settings.provider === 'openai' ? settings.openaiModel : 'Local AI'}</span>
          </div>

          <div style={{ display: 'flex', gap: '0.45rem' }}>
            {isStreaming ? (
              <button type="button" className={styles.hudActionBtn} onClick={handleStop}>
                <Square size={12} fill="#f87171" /> Stop
              </button>
            ) : (
              <button
                type="button"
                className={styles.hudActionBtn}
                onClick={() => void handleSend()}
                disabled={!query.trim()}
              >
                <Send size={12} /> Ask
              </button>
            )}

            {response && (
              <>
                <button
                  type="button"
                  className={styles.hudActionBtn}
                  onClick={() => {
                    navigator.clipboard.writeText(response);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                >
                  {copied ? (
                    <>
                      <Check size={12} color="#10b981" /> Copied
                    </>
                  ) : (
                    <>
                      <Copy size={12} /> Copy
                    </>
                  )}
                </button>
                <button
                  type="button"
                  className={`${styles.hudActionBtn} ${styles.hudContinueBtn}`}
                  onClick={handleContinueInCopilot}
                  title="Transfer this prompt and answer into the full Copilot thread"
                >
                  <Maximize2 size={12} /> Open in Copilot
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
