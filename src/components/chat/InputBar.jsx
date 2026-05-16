import { Send, Square, Paperclip, Mic, MicOff, X as LucideX } from 'lucide-react';
import ModelMenu from './ModelMenu';

export default function InputBar({
  input, onInputChange,
  isGenerating, providerStatus,
  isSttActive, voice,
  hasQueuedPrompt, queuedPromptDisplay,
  settings, availableModels, onModelChange,
  onSend, onStop, onSttToggle, onAttachOpen, onCancelQueue,
}) {
  const handleKeyDown = (e) => {
    if (e.key !== 'Enter') return;
    if (!e.ctrlKey && !e.shiftKey) {
      e.preventDefault();
      if (providerStatus.state === 'ready' && input.trim()) onSend();
    } else {
      e.preventDefault();
      const start = e.target.selectionStart;
      const end = e.target.selectionEnd;
      const next = input.substring(0, start) + '\n' + input.substring(end);
      onInputChange(next);
      setTimeout(() => { e.target.selectionStart = e.target.selectionEnd = start + 1; }, 0);
    }
  };

  const canSend = input.trim() && providerStatus.state === 'ready';
  const sendBg = !canSend ? 'var(--card-glass)' : isGenerating ? 'linear-gradient(135deg,#7c3aed,#6d28d9)' : 'var(--accent-gradient)';

  return (
    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '16px 24px 28px', background: 'linear-gradient(to top, var(--bg-main) 60%, transparent)', pointerEvents: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

      {/* Queued prompt pill */}
      {hasQueuedPrompt && (
        <div style={{ pointerEvents: 'auto', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.35)', borderRadius: '20px', padding: '6px 14px', maxWidth: '900px', width: '100%' }}>
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#a78bfa', flexShrink: 0, animation: 'pulse 1.2s infinite' }} />
          <span style={{ fontSize: '0.8rem', color: '#c4b5fd', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            Queued: {queuedPromptDisplay}
          </span>
          <button onClick={onCancelQueue}
            style={{ background: 'transparent', border: 'none', color: '#a78bfa', cursor: 'pointer', display: 'flex', alignItems: 'center', flexShrink: 0, padding: '2px' }}
            title="Cancel queued message"
          ><LucideX size={14} /></button>
        </div>
      )}

      {/* Stop button */}
      {isGenerating && (
        <div style={{ pointerEvents: 'auto', marginBottom: '16px' }}>
          <button onClick={onStop}
            style={{ background: 'var(--card-glass)', color: 'var(--text-primary)', border: '1px solid var(--card-border)', borderRadius: '20px', padding: '8px 16px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', boxShadow: '0 4px 15px rgba(0,0,0,0.2)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' }}
            onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
            onMouseOut={e => e.currentTarget.style.background = 'var(--card-glass)'}
          ><Square size={14} fill="currentColor" /> Stop Generating</button>
        </div>
      )}

      {/* Input box */}
      <div style={{ pointerEvents: 'auto', width: '100%', maxWidth: '900px', display: 'flex', alignItems: 'flex-end', background: 'var(--input-bg)', borderRadius: '24px', padding: '12px 16px', border: '1px solid var(--input-border)', boxShadow: '0 10px 40px rgba(0,0,0,0.3)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}>
        <textarea
          value={input}
          onChange={e => onInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message... (Shift+Enter for new line)"
          rows={input.split('\n').length > 1 ? Math.min(input.split('\n').length, 8) : 1}
          style={{ flex: 1, background: 'transparent', border: 'none', color: 'var(--text-primary)', outline: 'none', resize: 'none', maxHeight: '200px', padding: '8px 12px', fontSize: '1.05rem', lineHeight: 1.5 }}
        />

        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
          <ModelMenu
            settings={settings}
            availableModels={availableModels}
            isGenerating={isGenerating}
            onModelChange={onModelChange}
          />

          <button onClick={onAttachOpen}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '10px 4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onMouseOver={e => e.currentTarget.style.color = 'var(--text-primary)'}
            onMouseOut={e => e.currentTarget.style.color = 'var(--text-secondary)'}
            title="Attach Files"
          ><Paperclip size={20} /></button>

          {voice?.isSupported && (
            <button onClick={onSttToggle} disabled={isGenerating}
              style={{ background: isSttActive ? 'linear-gradient(135deg,#ef4444,#f87171)' : 'transparent', border: 'none', color: isSttActive ? '#fff' : (isGenerating ? 'var(--text-muted)' : 'var(--text-secondary)'), cursor: isGenerating ? 'not-allowed' : 'pointer', padding: '10px 4px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s', opacity: isGenerating ? 0.5 : 1, boxShadow: isSttActive ? '0 4px 15px rgba(239,68,68,0.4)' : 'none', borderRadius: isSttActive ? '12px' : '0' }}
              onMouseOver={e => { if (!isGenerating) e.currentTarget.style.color = 'var(--text-primary)'; }}
              onMouseOut={e => { if (!isGenerating) e.currentTarget.style.color = isSttActive ? '#fff' : 'var(--text-secondary)'; }}
              title={isSttActive ? 'Stop listening' : 'Voice input'}
            >
              {isSttActive ? <MicOff size={20} /> : <Mic size={20} />}
            </button>
          )}

          {input.length > 0 && (
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', opacity: 0.55, paddingBottom: '14px', minWidth: '36px', textAlign: 'right' }}>
              {input.length}
            </span>
          )}

          <button onClick={onSend} disabled={!canSend}
            style={{ width: '44px', height: '44px', borderRadius: '16px', background: sendBg, color: canSend ? '#fff' : 'var(--text-muted)', border: canSend ? 'none' : '1px solid var(--card-border)', marginLeft: '12px', cursor: canSend ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: canSend ? '0 4px 15px rgba(139,92,246,0.4)' : 'none' }}
            onMouseOver={e => { if (canSend) e.currentTarget.style.transform = 'scale(1.05)'; }}
            onMouseOut={e => { if (canSend) e.currentTarget.style.transform = 'scale(1)'; }}
            title={isGenerating && input.trim() ? 'Queue message' : 'Send message'}
          >
            <Send size={20} strokeWidth={2.5} style={{ position: 'relative', left: '1px' }} />
          </button>
        </div>
      </div>
    </div>
  );
}
