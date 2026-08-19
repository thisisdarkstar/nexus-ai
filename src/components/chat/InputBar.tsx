import { useEffect, useRef } from 'react';
import { Send, Square, Paperclip, Mic, MicOff, X as LucideX } from 'lucide-react';
import ModelMenu from './ModelMenu';
import type { Settings, AvailableModel, ProviderStatus, VoiceHook } from '../../types';
import styles from './InputBar.module.css';

interface InputBarProps {
  input: string;
  onInputChange: React.Dispatch<React.SetStateAction<string>>;
  isGenerating: boolean;
  providerStatus: ProviderStatus;
  isSttActive: boolean;
  voice: VoiceHook;
  hasQueuedPrompt: boolean;
  queuedPromptDisplay: string;
  settings: Settings;
  availableModels: AvailableModel[];
  onModelChange: (provider: string, model: string) => void;
  onSend: () => void;
  onStop: () => void;
  onSttToggle: () => void;
  onAttachOpen: () => void;
  onCancelQueue: () => void;
}

export default function InputBar({
  input,
  onInputChange,
  isGenerating,
  providerStatus,
  isSttActive,
  voice,
  hasQueuedPrompt,
  queuedPromptDisplay,
  settings,
  availableModels,
  onModelChange,
  onSend,
  onStop,
  onSttToggle,
  onAttachOpen,
  onCancelQueue,
}: InputBarProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [input]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Enter') return;
    if (!e.ctrlKey && !e.shiftKey) {
      e.preventDefault();
      if (providerStatus.state === 'ready' && input.trim()) onSend();
    } else {
      e.preventDefault();
      const target = e.target as HTMLTextAreaElement;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const next = input.substring(0, start) + '\n' + input.substring(end);
      onInputChange(next);
      setTimeout(() => {
        target.selectionStart = target.selectionEnd = start + 1;
      }, 0);
    }
  };

  const canSend = input.trim() && providerStatus.state === 'ready';

  return (
    <div className={styles.container}>
      {hasQueuedPrompt && (
        <div className={styles.queuedPill}>
          <div className={styles.queuedDot} />
          <span className={styles.queuedText}>Queued: {queuedPromptDisplay}</span>
          <button
            onClick={onCancelQueue}
            className={styles.queuedCancel}
            title="Cancel queued message"
          >
            <LucideX size={14} />
          </button>
        </div>
      )}

      {isGenerating && (
        <div className={styles.stopContainer}>
          <button onClick={onStop} className={styles.stopBtn}>
            <Square size={14} fill="currentColor" /> Stop Generating
          </button>
        </div>
      )}

      <div className={styles.inputBox}>
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message Nexus..."
          rows={1}
          className={styles.textarea}
        />

        <div className={styles.toolbar}>
          <div className={styles.toolbarLeft}>
            <ModelMenu
              settings={settings}
              availableModels={availableModels}
              isGenerating={isGenerating}
              onModelChange={onModelChange}
            />

            <button onClick={onAttachOpen} className={styles.toolBtn} title="Attach Files">
              <Paperclip size={18} />
            </button>

            {voice?.isSupported && (
              <button
                onClick={onSttToggle}
                disabled={isGenerating}
                className={`${styles.toolBtn} ${isSttActive ? styles.micActive : ''} ${isGenerating ? styles.toolBtnDisabled : ''}`}
                title={isSttActive ? 'Stop listening' : 'Voice input'}
              >
                {isSttActive ? <MicOff size={18} /> : <Mic size={18} />}
              </button>
            )}
          </div>

          <div className={styles.toolbarRight}>
            {input.length > 0 && <span className={styles.charCount}>{input.length}</span>}

            <button
              onClick={onSend}
              disabled={!canSend}
              className={`${styles.sendBtn} ${!canSend ? styles.sendBtnDisabled : ''}`}
              title={isGenerating && input.trim() ? 'Queue message' : 'Send message'}
            >
              {isGenerating ? (
                <Square size={16} fill="currentColor" />
              ) : (
                <Send size={16} />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
