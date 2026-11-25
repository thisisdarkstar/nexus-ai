import type { SecurityPersonaPreset } from './CopilotDrawer';
import styles from './CopilotDrawer.module.css';

interface PresetsPanelProps {
  presets: SecurityPersonaPreset[];
  chatSystemPrompt: string;
  onActivatePreset: (preset: SecurityPersonaPreset) => void;
}

/**
 * Security persona & starter prompt selector gallery inside Copilot Drawer.
 */
export default function PresetsPanel({
  presets,
  chatSystemPrompt,
  onActivatePreset,
}: PresetsPanelProps) {
  return (
    <div className={styles.subTabContent}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>Security Personas & Prompts</div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
            Switch specialist instructions and starter workflows in 1 click.
          </div>
        </div>
      </div>

      <div className={styles.presetsGrid}>
        {presets.map((preset) => {
          const PresetIcon = preset.icon;
          const isCurrent = chatSystemPrompt === preset.systemPrompt;
          return (
            <div
              key={preset.id}
              className={styles.presetCard}
              onClick={() => onActivatePreset(preset)}
            >
              <div className={styles.presetHeader}>
                <div className={styles.presetTitleGroup}>
                  <PresetIcon size={16} color={preset.color} />
                  <span style={{ color: preset.color }}>{preset.name}</span>
                </div>
                {isCurrent && (
                  <span
                    style={{
                      fontSize: '0.65rem',
                      background: 'rgba(16, 185, 129, 0.2)',
                      color: '#10b981',
                      padding: '0.1rem 0.4rem',
                      borderRadius: '4px',
                      fontWeight: 600,
                    }}
                  >
                    Active
                  </span>
                )}
              </div>
              <p className={styles.presetDesc}>{preset.description}</p>
              <div className={styles.presetSample}>"{preset.samplePrompt}"</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
