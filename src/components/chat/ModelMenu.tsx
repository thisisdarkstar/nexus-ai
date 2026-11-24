import { useState, useMemo } from 'react';
import { Sparkles, ChevronUp, Check, RotateCw, Server, Cpu } from 'lucide-react';
import type { Settings, AvailableModel } from '../../types';
import styles from './ModelMenu.module.css';

interface ModelMenuProps {
  settings: Settings;
  availableModels: AvailableModel[];
  isGenerating: boolean;
  onModelChange: (provider: string, model: string, endpointId?: string) => void;
  triggerClassName?: string;
}

export default function ModelMenu({
  settings,
  availableModels,
  isGenerating,
  onModelChange,
  triggerClassName = '',
}: ModelMenuProps) {
  const [isOpen, setIsOpen] = useState(false);

  const currentLabel =
    settings.provider === 'openai' ? settings.openaiModel || 'Select Model' : 'Gemini Nano';

  // Group models by endpoint
  const groupedModels = useMemo(() => {
    const groups: Record<string, AvailableModel[]> = {};
    availableModels.forEach((m) => {
      const groupName = m.endpointName || 'OpenAI Compatible';
      if (!groups[groupName]) groups[groupName] = [];
      groups[groupName].push(m);
    });
    return groups;
  }, [availableModels]);

  return (
    <div className={styles.container}>
      <button
        onClick={() => setIsOpen((o) => !o)}
        disabled={isGenerating}
        className={`${styles.trigger} ${isGenerating ? styles.triggerDisabled : ''} ${triggerClassName}`}
        title={`Active Model: ${currentLabel}`}
      >
        <Sparkles size={13} />
        <span>{currentLabel}</span>
        <ChevronUp size={13} className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ''}`} />
      </button>

      {isOpen && (
        <>
          <div className={styles.overlay} onClick={() => setIsOpen(false)} />
          <div className={styles.menu}>
            <div className={styles.menuHeader}>
              <span>Switch AI Model</span>
              <Sparkles size={12} />
            </div>

            {/* Built-in Chrome Gemini Nano */}
            <button
              onClick={() => {
                onModelChange('chrome', 'Gemini Nano');
                setIsOpen(false);
              }}
              className={`${styles.option} ${settings.provider === 'chrome' ? styles.optionActive : ''}`}
            >
              <Cpu size={14} color="#10b981" />
              <span>Gemini Nano (Built-in)</span>
              {settings.provider === 'chrome' && <Check size={14} className={styles.check} />}
            </button>

            {Object.keys(groupedModels).length > 0 && <div className={styles.divider} />}

            {/* Models Grouped by Endpoint */}
            {Object.entries(groupedModels).map(([endpointName, models]) => (
              <div key={endpointName} style={{ marginBottom: '4px' }}>
                <div className={styles.endpointGroupHeader}>
                  <Server size={11} />
                  <span>{endpointName}</span>
                </div>
                {models.map((m) => {
                  const active = settings.provider === 'openai' && settings.openaiModel === m.id;
                  return (
                    <button
                      key={`${m.endpointId || 'ep'}-${m.id}`}
                      onClick={() => {
                        onModelChange('openai', m.id, m.endpointId);
                        setIsOpen(false);
                      }}
                      className={`${styles.option} ${active ? styles.optionActive : ''}`}
                      title={`${m.id} (${endpointName})`}
                    >
                      <RotateCw size={12} style={{ flexShrink: 0 }} />
                      <span className={styles.optionLabel}>{m.id}</span>
                      {active && <Check size={14} className={styles.check} />}
                    </button>
                  );
                })}
              </div>
            ))}

            {availableModels.length === 0 && (
              <div style={{ padding: '10px 12px', fontSize: '0.74rem', color: '#64748b', textAlign: 'center' }}>
                No active models detected. Ensure Ollama, LM Studio, or an API key is configured.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
