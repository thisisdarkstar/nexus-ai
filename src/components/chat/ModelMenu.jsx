import { useState } from 'react';
import { Sparkles, ChevronUp, Check, RotateCw } from 'lucide-react';

export default function ModelMenu({ settings, availableModels, isGenerating, onModelChange }) {
  const [isOpen, setIsOpen] = useState(false);

  const currentLabel = settings.provider === 'openai'
    ? (settings.openaiModel || 'Select Model')
    : 'Gemini Nano';

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setIsOpen(o => !o)}
        disabled={isGenerating}
        style={{ height: '44px', background: 'var(--card-glass)', border: '1px solid var(--card-border)', color: 'var(--accent-color)', borderRadius: '16px', padding: '0 16px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', cursor: isGenerating ? 'not-allowed' : 'pointer', transition: 'all 0.2s', fontWeight: 600, opacity: isGenerating ? 0.5 : 1, whiteSpace: 'nowrap' }}
        onMouseOver={e => { if (!isGenerating) e.currentTarget.style.background = 'rgba(139,92,246,0.1)'; }}
        onMouseOut={e => { if (!isGenerating) e.currentTarget.style.background = 'var(--card-glass)'; }}
      >
        <Sparkles size={16} />
        <span>{currentLabel}</span>
        <ChevronUp size={16} style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', color: 'var(--text-secondary)' }} />
      </button>

      {isOpen && (
        <>
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 90 }} onClick={() => setIsOpen(false)} />
          <div style={{ position: 'absolute', bottom: '100%', right: 0, marginBottom: '12px', width: '300px', background: 'rgba(23,23,33,0.98)', border: '1px solid var(--sidebar-border)', borderRadius: '20px', padding: '10px', zIndex: 100, boxShadow: '0 20px 60px rgba(0,0,0,0.8)', backdropFilter: 'blur(50px)', WebkitBackdropFilter: 'blur(50px)', maxHeight: '400px', overflowY: 'auto', borderBottom: '2px solid var(--accent-color)' }}>
            <div style={{ padding: '10px 14px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>Switch Model</span>
              <Sparkles size={12} />
            </div>

            <button
              onClick={() => { onModelChange('chrome', 'Gemini Nano'); setIsOpen(false); }}
              style={{ width: '100%', textAlign: 'left', padding: '10px 12px', background: settings.provider === 'chrome' ? 'rgba(139,92,246,0.2)' : 'transparent', border: 'none', borderRadius: '10px', color: settings.provider === 'chrome' ? '#fff' : 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem', transition: 'all 0.2s' }}
              onMouseOver={e => { if (settings.provider !== 'chrome') { e.currentTarget.style.background = 'var(--card-glass)'; e.currentTarget.style.color = 'var(--text-primary)'; } }}
              onMouseOut={e => { if (settings.provider !== 'chrome') { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; } }}
            >
              <Sparkles size={14} color="var(--accent-color)" />
              <span>Gemini Nano (Built-in)</span>
              {settings.provider === 'chrome' && <Check size={14} style={{ marginLeft: 'auto', color: '#34d399' }} />}
            </button>

            {availableModels.length > 0 && <div style={{ margin: '8px 0', height: '1px', background: 'var(--sidebar-border)' }} />}

            {availableModels.map(m => {
              const active = settings.provider === 'openai' && settings.openaiModel === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => { onModelChange('openai', m.id); setIsOpen(false); }}
                  style={{ width: '100%', textAlign: 'left', padding: '10px 12px', background: active ? 'rgba(139,92,246,0.2)' : 'transparent', border: 'none', borderRadius: '10px', color: active ? '#fff' : 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem', transition: 'all 0.2s' }}
                  onMouseOver={e => { if (!active) { e.currentTarget.style.background = 'var(--card-glass)'; e.currentTarget.style.color = 'var(--text-primary)'; } }}
                  onMouseOut={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; } }}
                >
                  <RotateCw size={14} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.id}</span>
                  {active && <Check size={14} style={{ marginLeft: 'auto', color: '#34d399' }} />}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
