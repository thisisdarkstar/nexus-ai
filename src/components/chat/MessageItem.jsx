import { useState, useEffect, useRef } from 'react';
import { Copy, Check, Edit2, RotateCw, ChevronDown, Clock, Code2, Volume2, VolumeX, Sparkles } from 'lucide-react';
import { renderMarkdown } from '../../lib/markdown';

export default function MessageItem({ msg, i, isGenerating, onEdit, onRegenerate, onCopy, copiedIndex, onSpeak, isSpeaking, availableModels, settings }) {
  const bodyRef = useRef(null);
  const [showRaw, setShowRaw] = useState(false);
  const [showRetryMenu, setShowRetryMenu] = useState(false);

  useEffect(() => {
    if (!bodyRef.current || showRaw) return;
    bodyRef.current.querySelectorAll('.code-copy-btn').forEach(b => b.remove());
    bodyRef.current.querySelectorAll('pre').forEach(pre => {
      const btn = document.createElement('button');
      btn.className = 'code-copy-btn';
      btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg> Copy';
      btn.onclick = () => {
        navigator.clipboard.writeText(pre.querySelector('code')?.innerText || '');
        btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> Copied';
        setTimeout(() => {
          btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg> Copy';
        }, 2000);
      };
      pre.style.position = 'relative';
      pre.appendChild(btn);
    });
  }, [msg.content, showRaw]);

  const plainText = msg.content ? msg.content.replace(/[#*_`[\]()]/g, '').replace(/\n/g, ' ').trim() : '';
  const isUser = msg.role === 'user';

  const retryOptions = [
    { label: 'Same model', provider: null, modelId: null },
    { label: 'Gemini Nano', provider: 'chrome', modelId: null },
    ...(availableModels || []).map(m => ({ label: m.id, provider: 'openai', modelId: m.id }))
  ];

  return (
    <div className="message-container" style={{ display: 'flex', flexDirection: 'column', alignItems: isUser ? 'flex-end' : 'flex-start', marginBottom: '8px' }}>
      <div className="message-bubble" style={{
        maxWidth: '85%', minWidth: 0, overflow: 'hidden',
        background: isUser ? 'var(--accent-gradient)' : 'var(--card-glass)',
        padding: isUser ? '14px 22px' : '18px 24px',
        borderRadius: isUser ? '20px 20px 4px 20px' : '4px 20px 20px 20px',
        color: isUser ? '#fff' : 'var(--text-primary)',
        border: isUser ? 'none' : '1px solid var(--card-border)',
        boxShadow: isUser ? '0 10px 25px rgba(139,92,246,0.2)' : '0 10px 30px rgba(0,0,0,0.1)',
      }}>
        {!isUser && msg.content && showRaw ? (
          <pre className="message-body" style={{ whiteSpace: 'pre-wrap', fontFamily: 'Consolas, monospace', fontSize: '0.875em', lineHeight: 1.6, margin: 0 }}>
            {msg.content}
          </pre>
        ) : (
          <div
            ref={bodyRef}
            className="message-body"
            dangerouslySetInnerHTML={{
              __html: !isUser && msg.content
                ? renderMarkdown(msg.content)
                : !msg.content
                  ? '<span style="opacity:0.7; animation: pulse 2s infinite">Thinking...</span>'
                  : msg.content.replace(/\n/g, '<br/>')
            }}
          />
        )}
      </div>

      {msg.content && (
        <div className="message-actions" style={{ display: 'flex', marginTop: '6px', padding: '0 8px', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>

          {isUser && !isGenerating && (
            <button onClick={() => onEdit(i)}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', fontWeight: 500 }}
              onMouseOver={e => e.currentTarget.style.color = 'var(--text-primary)'}
              onMouseOut={e => e.currentTarget.style.color = 'var(--text-muted)'}
              title="Edit message"
            ><Edit2 size={14} /> Edit</button>
          )}

          {!isUser && !isGenerating && (
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <button onClick={() => onRegenerate(i)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', fontWeight: 500 }}
                onMouseOver={e => e.currentTarget.style.color = 'var(--text-primary)'}
                onMouseOut={e => e.currentTarget.style.color = 'var(--text-muted)'}
                title="Regenerate response"
              ><RotateCw size={14} /> Regenerate</button>
              <button onClick={() => setShowRetryMenu(s => !s)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '0 2px' }}
                onMouseOver={e => e.currentTarget.style.color = 'var(--text-primary)'}
                onMouseOut={e => e.currentTarget.style.color = 'var(--text-muted)'}
                title="Retry with different model"
              ><ChevronDown size={12} /></button>

              {showRetryMenu && (
                <>
                  <div style={{ position: 'fixed', inset: 0, zIndex: 90 }} onClick={() => setShowRetryMenu(false)} />
                  <div style={{ position: 'absolute', bottom: 'calc(100% + 6px)', left: 0, background: 'rgba(15,23,42,0.98)', border: '1px solid var(--sidebar-border)', borderRadius: '14px', padding: '6px', zIndex: 100, minWidth: '200px', boxShadow: '0 10px 40px rgba(0,0,0,0.6)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)' }}>
                    <div style={{ padding: '5px 10px 8px', fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>Retry with</div>
                    {retryOptions.map((opt, idx) => {
                      const isCurrent = settings && (
                        (opt.provider === null) ||
                        (opt.provider === 'chrome' && settings.provider === 'chrome') ||
                        (opt.provider === 'openai' && settings.provider === 'openai' && settings.openaiModel === opt.modelId)
                      );
                      return (
                        <button key={idx} onClick={() => { onRegenerate(i, opt.provider, opt.modelId); setShowRetryMenu(false); }}
                          style={{ width: '100%', textAlign: 'left', padding: '8px 12px', background: 'transparent', border: 'none', borderRadius: '10px', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', transition: 'all 0.15s' }}
                          onMouseOver={e => { e.currentTarget.style.background = 'var(--card-glass)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                          onMouseOut={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                        >
                          {opt.provider === 'chrome' ? <Sparkles size={12} color="var(--accent-color)" /> : <RotateCw size={12} />}
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{opt.label}</span>
                          {isCurrent && <Check size={11} style={{ marginLeft: 'auto', color: '#34d399', flexShrink: 0 }} />}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          <button onClick={() => onCopy(msg.content, i)}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', fontWeight: 500 }}
            onMouseOver={e => e.currentTarget.style.color = 'var(--text-primary)'}
            onMouseOut={e => e.currentTarget.style.color = 'var(--text-muted)'}
            title="Copy message"
          >
            {copiedIndex === i ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy</>}
          </button>

          {!isUser && !isGenerating && (
            <button onClick={() => setShowRaw(s => !s)}
              style={{ background: 'transparent', border: 'none', color: showRaw ? 'var(--text-primary)' : 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', fontWeight: 500 }}
              onMouseOver={e => e.currentTarget.style.color = 'var(--text-primary)'}
              onMouseOut={e => e.currentTarget.style.color = showRaw ? 'var(--text-primary)' : 'var(--text-muted)'}
              title={showRaw ? 'Show rendered' : 'Show raw markdown'}
            ><Code2 size={14} /> {showRaw ? 'Rendered' : 'Source'}</button>
          )}

          {!isUser && onSpeak && (
            <button onClick={() => onSpeak(plainText, i)}
              style={{ background: 'transparent', border: 'none', color: isSpeaking ? 'var(--accent-color)' : 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', fontWeight: 500, animation: isSpeaking ? 'pulse 1s infinite' : 'none' }}
              onMouseOver={e => e.currentTarget.style.color = 'var(--text-primary)'}
              onMouseOut={e => e.currentTarget.style.color = isSpeaking ? 'var(--accent-color)' : 'var(--text-muted)'}
              title={isSpeaking ? 'Stop speaking' : 'Speak message'}
            >
              {isSpeaking ? <VolumeX size={14} /> : <Volume2 size={14} />}
              {isSpeaking ? 'Stop' : 'Speak'}
            </button>
          )}

          {(msg.generationTime || msg.createdAt) && (
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '4px', opacity: 0.8 }}>
              {msg.generationTime && <><Clock size={12} /> {msg.generationTime}s{msg.createdAt ? ' ·' : ''}</>}
              {msg.createdAt && new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
