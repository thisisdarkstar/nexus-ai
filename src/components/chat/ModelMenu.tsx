import { useState } from 'react';
import { Sparkles, ChevronUp, Check, RotateCw } from 'lucide-react';
import type { Settings, AvailableModel } from '../../types';
import styles from './ModelMenu.module.css';

interface ModelMenuProps {
  settings: Settings;
  availableModels: AvailableModel[];
  isGenerating: boolean;
  onModelChange: (provider: string, model: string) => void;
}

export default function ModelMenu({
  settings,
  availableModels,
  isGenerating,
  onModelChange,
}: ModelMenuProps) {
  const [isOpen, setIsOpen] = useState(false);

  const currentLabel =
    settings.provider === 'openai' ? settings.openaiModel || 'Select Model' : 'Gemini Nano';

  return (
    <div className={styles.container}>
      <button
        onClick={() => setIsOpen((o) => !o)}
        disabled={isGenerating}
        className={`${styles.trigger} ${isGenerating ? styles.triggerDisabled : ''}`}
        title={`Selected Model: ${currentLabel}`}
      >
        <Sparkles size={14} style={{ flexShrink: 0 }} />
        <span className={styles.triggerLabel}>{currentLabel}</span>
        <ChevronUp size={14} className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ''}`} style={{ flexShrink: 0 }} />
      </button>

      {isOpen && (
        <>
          <div className={styles.overlay} onClick={() => setIsOpen(false)} />
          <div className={styles.menu}>
            <div className={styles.menuHeader}>
              <span>Switch Model</span>
              <Sparkles size={12} />
            </div>

            <button
              onClick={() => {
                onModelChange('chrome', 'Gemini Nano');
                setIsOpen(false);
              }}
              className={`${styles.option} ${settings.provider === 'chrome' ? styles.optionActive : ''}`}
            >
              <Sparkles size={14} color="var(--accent-color)" />
              <span>Gemini Nano (Built-in)</span>
              {settings.provider === 'chrome' && <Check size={14} className={styles.check} />}
            </button>

            {availableModels.length > 0 && <div className={styles.divider} />}

            {availableModels.map((m) => {
              const active = settings.provider === 'openai' && settings.openaiModel === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => {
                    onModelChange('openai', m.id);
                    setIsOpen(false);
                  }}
                  className={`${styles.option} ${active ? styles.optionActive : ''}`}
                >
                  <RotateCw size={14} />
                  <span className={styles.optionLabel}>{m.id}</span>
                  {active && <Check size={14} className={styles.check} />}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
