import { Activity, Cpu, SlidersHorizontal, Info } from 'lucide-react';
import CustomSelect from '../common/CustomSelect';
import type { Settings } from '../../types';
import styles from './CopilotDrawer.module.css';

interface ModelDetails {
  format?: string;
  family?: string;
  parameterSize?: string;
  quantization?: string;
  sizeBytes?: number;
  capabilities?: string[];
}

interface TelemetryPanelProps {
  settings: Settings;
  modelDetails: ModelDetails | null;
  estimatedTokens: number;
  contextLimit: number;
  contextPercent: number;
  onSettingsChange?: (newSettings: Partial<Settings>) => void;
}

export default function TelemetryPanel({
  settings,
  modelDetails,
  estimatedTokens,
  contextLimit,
  contextPercent,
  onSettingsChange,
}: TelemetryPanelProps) {
  return (
    <div className={styles.subTabContent}>
      <div className={styles.telemetryCard}>
        <div className={styles.telemetryCardTitle}>
          <Activity size={15} color="#38bdf8" />
          <span>Active Inference Engine</span>
        </div>
        <div className={styles.telemetryStatsRow}>
          <span>Provider:</span>
          <strong style={{ textTransform: 'capitalize', color: 'var(--text-primary)' }}>
            {settings.provider}
          </strong>
        </div>
        <div className={styles.telemetryStatsRow}>
          <span>Model:</span>
          <strong style={{ color: '#38bdf8' }}>
            {settings.provider === 'openai' ? settings.openaiModel || 'Default Model' : 'Gemini Nano'}
          </strong>
        </div>
        <div className={styles.telemetryStatsRow}>
          <span>Base URL:</span>
          <span style={{ fontFamily: 'monospace', fontSize: '0.7rem' }}>
            {settings.openaiBaseUrl}
          </span>
        </div>
        {modelDetails && (
          <>
            <div className={styles.telemetryStatsRow}>
              <span>Architecture / Family:</span>
              <strong style={{ color: 'var(--text-primary)' }}>
                {modelDetails.family || 'GGUF'} ({modelDetails.format || 'gguf'})
              </strong>
            </div>
            {modelDetails.parameterSize && (
              <div className={styles.telemetryStatsRow}>
                <span>Parameter Size:</span>
                <strong style={{ color: '#10b981' }}>{modelDetails.parameterSize}</strong>
              </div>
            )}
            {modelDetails.quantization && (
              <div className={styles.telemetryStatsRow}>
                <span>Quantization Tier:</span>
                <strong style={{ color: '#f59e0b' }}>{modelDetails.quantization}</strong>
              </div>
            )}
            {modelDetails.sizeBytes && (
              <div className={styles.telemetryStatsRow}>
                <span>Memory Footprint:</span>
                <span>{(modelDetails.sizeBytes / (1024 * 1024 * 1024)).toFixed(2)} GB</span>
              </div>
            )}
            {modelDetails.capabilities && modelDetails.capabilities.length > 0 && (
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '4px' }}>
                {modelDetails.capabilities.map((cap, ci) => (
                  <span
                    key={ci}
                    style={{
                      fontSize: '0.65rem',
                      background: 'rgba(56, 189, 248, 0.1)',
                      color: '#38bdf8',
                      padding: '1px 6px',
                      borderRadius: '4px',
                      textTransform: 'uppercase',
                      fontWeight: 600,
                    }}
                  >
                    {cap}
                  </span>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <div className={styles.telemetryCard}>
        <div className={styles.telemetryCardTitle}>
          <Cpu size={15} color="#10b981" />
          <span>Context Window Gauge</span>
        </div>
        <div className={styles.telemetryMeterTrack}>
          <div
            className={styles.telemetryMeterFill}
            style={{
              width: `${contextPercent}%`,
              backgroundColor:
                contextPercent > 85 ? '#ef4444' : contextPercent > 65 ? '#f59e0b' : '#10b981',
            }}
          />
        </div>
        <div className={styles.telemetryStatsRow}>
          <span>Estimated Tokens Used:</span>
          <strong>
            ~{estimatedTokens.toLocaleString()} / {contextLimit.toLocaleString()} ({contextPercent}%)
          </strong>
        </div>
      </div>

      <div className={styles.telemetryCard}>
        <div className={styles.telemetryCardTitle}>
          <SlidersHorizontal size={15} color="#f59e0b" />
          <span>Interactive Hyperparameters</span>
        </div>
        <div className={styles.telemetryControlRow}>
          <div className={styles.telemetryControlLabel}>
            <span>Temperature</span>
            <strong>{settings.temperature}</strong>
          </div>
          <input
            type="range"
            min="0"
            max="1.5"
            step="0.05"
            value={settings.temperature}
            onChange={(e) => onSettingsChange?.({ temperature: parseFloat(e.target.value) })}
            className={styles.telemetrySlider}
          />
        </div>

        <div className={styles.telemetryControlRow} style={{ marginTop: '0.5rem' }}>
          <div className={styles.telemetryControlLabel}>
            <span>Top P (Nucleus Sampling)</span>
            <strong>{settings.topP ?? 0.9}</strong>
          </div>
          <input
            type="range"
            min="0.1"
            max="1.0"
            step="0.05"
            value={settings.topP ?? 0.9}
            onChange={(e) => onSettingsChange?.({ topP: parseFloat(e.target.value) })}
            className={styles.telemetrySlider}
          />
        </div>

        <div className={styles.telemetryControlRow} style={{ marginTop: '0.5rem' }}>
          <div className={styles.telemetryControlLabel}>
            <span>Repeat Penalty</span>
            <strong>{settings.repeatPenalty ?? 1.1}</strong>
          </div>
          <input
            type="range"
            min="1.0"
            max="1.5"
            step="0.05"
            value={settings.repeatPenalty ?? 1.1}
            onChange={(e) => onSettingsChange?.({ repeatPenalty: parseFloat(e.target.value) })}
            className={styles.telemetrySlider}
          />
        </div>

        <div className={styles.telemetryControlRow} style={{ marginTop: '0.5rem' }}>
          <div className={styles.telemetryControlLabel}>
            <span>Context Size (num_ctx)</span>
            <strong>{((settings.contextWindow || 16384) / 1024).toFixed(0)}K tokens</strong>
          </div>
          <CustomSelect
            value={String(settings.contextWindow || 16384)}
            onChange={(val) => onSettingsChange?.({ contextWindow: parseInt(val, 10) })}
            options={[
              { value: '2048', label: '2,048 tokens (2K)' },
              { value: '4096', label: '4,096 tokens (4K)' },
              { value: '8192', label: '8,192 tokens (8K)' },
              { value: '16384', label: '16,384 tokens (16K - Recommended)' },
              { value: '32768', label: '32,768 tokens (32K)' },
              { value: '65536', label: '65,536 tokens (64K)' },
              { value: '131072', label: '131,072 tokens (128K)' },
            ]}
            ariaLabel="Context window size"
            style={{ width: '100%' }}
          />
        </div>
      </div>

      <div className={styles.telemetryNote}>
        <div
          style={{
            fontWeight: 600,
            marginBottom: '2px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <Info size={12} /> Local VRAM &amp; GPU Offload Tip
        </div>
        To offload 100% of layers into GPU VRAM (reducing CPU and RAM usage), ensure your Ollama
        model fits in VRAM. For 8GB VRAM GPUs, 7B/8B Q4_K_M or Q5_K_M models fit completely into
        VRAM for lightning-fast inference.
      </div>
    </div>
  );
}
