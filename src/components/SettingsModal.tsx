import { useState, useEffect, useRef } from 'react';
import { X, Download, Upload, Monitor, Volume2 } from 'lucide-react';
import { db } from '../lib/db';
import { DEFAULT_OPENAI_BASE_URL } from '../lib/constants';
import CustomSelect from './CustomSelect';
import type { Settings } from '../types';
import styles from './SettingsModal.module.css';

const PROVIDER_OPTIONS = [
  { value: 'chrome', label: 'Chrome Gemini Nano (On-Device)', badge: 'Local' },
  { value: 'openai', label: 'OpenAI Compatible API (Ollama / LM Studio)', badge: 'Custom' },
];

const THEME_OPTIONS = [
  { value: 'dark', label: 'Deep Nebula (Dark Theme)' },
  { value: 'light', label: 'Clear Sky (Light Theme)' },
];

const MAX_TOKENS_OPTIONS = [
  { value: '1024', label: '1,024 - Short responses' },
  { value: '2048', label: '2,048 - Standard' },
  { value: '4096', label: '4,096 - Detailed (default)' },
  { value: '8192', label: '8,192 - Long code / analysis' },
  { value: '16384', label: '16,384 - Very long outputs' },
  { value: '32768', label: '32,768 - Maximum' },
];

interface SettingsModalProps {
  settings: Settings;
  onSave: (newSettings: Partial<Settings>) => void;
  onClose: () => void;
  onClearChats: () => void;
  reloadChats?: () => void;
  availableVoices?: SpeechSynthesisVoice[];
}

export default function SettingsModal({
  settings,
  onSave,
  onClose,
  onClearChats,
  reloadChats,
  availableVoices = [],
}: SettingsModalProps) {
  const [provider, setProvider] = useState(settings.provider || 'chrome');
  const [theme, setTheme] = useState(settings.theme || 'dark');
  const [systemPrompt, setSystemPrompt] = useState(settings.systemPrompt || '');
  const [openaiBaseUrl, setOpenaiBaseUrl] = useState(
    settings.openaiBaseUrl || DEFAULT_OPENAI_BASE_URL
  );
  const [openaiApiKey, setOpenaiApiKey] = useState(settings.openaiApiKey || 'sk-local');
  const [openaiModel, setOpenaiModel] = useState(settings.openaiModel || '');
  const [availableModels, setAvailableModels] = useState<Array<{ id: string }>>([]);
  const [temperature, setTemperature] = useState(settings.temperature ?? 0.7);
  const [maxTokens, setMaxTokens] = useState(settings.maxTokens ?? 4096);
  const [ttsVoice, setTtsVoice] = useState(settings.ttsVoice || '');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const enVoices = availableVoices
    .filter((v) => v.lang.startsWith('en'))
    .sort((a, b) => {
      const score = (v: SpeechSynthesisVoice) => {
        if (/natural/i.test(v.name)) return 0;
        if (/google/i.test(v.name)) return 1;
        if (/(enhanced|premium)/i.test(v.name)) return 2;
        if (/online/i.test(v.name)) return 3;
        return 4;
      };
      return score(a) - score(b) || a.name.localeCompare(b.name);
    });

  const testVoice = () => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance('Hello! This is how I sound.');
    u.rate = 0.95;
    if (ttsVoice) {
      const v = availableVoices.find((v) => v.name === ttsVoice);
      if (v) u.voice = v;
    }
    window.speechSynthesis.speak(u);
  };

  useEffect(() => {
    if (provider === 'openai') {
      const fetchModels = async () => {
        try {
          const res = await fetch(`${openaiBaseUrl}/models`, {
            headers: { Authorization: `Bearer ${openaiApiKey}` },
          });
          if (res.ok) {
            const data = await res.json();
            const models = data.data || [];
            setAvailableModels(models);
            if (models.length > 0 && !openaiModel) {
              setOpenaiModel(models[0].id);
            }
          }
        } catch (e) {
          console.error('Failed to fetch models', e);
        }
      };
      fetchModels();
    }
  }, [provider, openaiBaseUrl, openaiApiKey]);

  const handleSave = () => {
    onSave({
      provider,
      theme,
      systemPrompt,
      openaiBaseUrl,
      openaiApiKey,
      openaiModel,
      temperature: parseFloat(String(temperature)),
      maxTokens: parseInt(String(maxTokens), 10),
      ttsVoice,
    });
    onClose();
  };

  const handleExport = async () => {
    const data = await db.exportAll();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'nexus_backup.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 100);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        await db.importData(event.target?.result as string);
        alert('Import successful!');
        if (reloadChats) reloadChats();
      } catch (err) {
        alert('Import failed: ' + (err instanceof Error ? err.message : String(err)));
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} role="dialog" aria-modal="true" aria-label="System Configuration" onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.headerContent}>
            <Monitor size={20} color="var(--accent-color)" />
            <h2 className={styles.headerTitle}>System Configuration</h2>
          </div>
          <button onClick={onClose} className={styles.closeBtn}>
            <X size={16} />
          </button>
        </div>

        <div className={styles.body}>
          <div className={styles.row}>
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Provider</label>
              <CustomSelect
                value={provider}
                options={PROVIDER_OPTIONS}
                onChange={(val) => setProvider(val as Settings['provider'])}
              />
            </div>
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Theme</label>
              <CustomSelect
                value={theme}
                options={THEME_OPTIONS}
                onChange={(val) => setTheme(val as Settings['theme'])}
              />
            </div>
          </div>

          {provider === 'openai' && (
            <div className={styles.apiSection}>
              <h4 className={styles.apiSectionTitle}>OpenAI API Settings</h4>
              <div className={styles.apiRow}>
                <div className={`${styles.apiField} ${styles.apiFieldWide}`}>
                  <label className={styles.apiLabel}>Base URL</label>
                  <input
                    value={openaiBaseUrl}
                    onChange={(e) => setOpenaiBaseUrl(e.target.value)}
                    className={styles.apiInput}
                  />
                </div>
                <div className={`${styles.apiField} ${styles.apiFieldNarrow}`}>
                  <label className={styles.apiLabel}>API Key</label>
                  <input
                    type="password"
                    value={openaiApiKey}
                    onChange={(e) => setOpenaiApiKey(e.target.value)}
                    className={styles.apiInput}
                  />
                </div>
              </div>
              <div className={styles.apiField}>
                <label className={styles.apiLabel}>Model</label>
                <CustomSelect
                  value={openaiModel}
                  placeholder={availableModels.length === 0 ? 'No models found or server unreachable' : 'Select model...'}
                  options={availableModels.map((m) => ({ value: m.id, label: m.id }))}
                  onChange={(val) => setOpenaiModel(val)}
                  disabled={availableModels.length === 0}
                />
              </div>
            </div>
          )}

          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>Global System Prompt</label>
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="e.g. You are an expert coding assistant..."
              className={styles.textarea}
            />
          </div>

          <div className={styles.row}>
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>
                Temperature{' '}
                <span className={styles.fieldLabelValue}>
                  {parseFloat(String(temperature)).toFixed(1)}
                </span>
              </label>
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value) || 0.7)}
                className={styles.sliderContainer}
              />
              <div className={styles.sliderLabels}>
                <span>Focused</span>
                <span>Balanced</span>
                <span>Creative</span>
              </div>
            </div>
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Max Tokens</label>
              <CustomSelect
                value={String(maxTokens)}
                options={MAX_TOKENS_OPTIONS}
                onChange={(val) => setMaxTokens(parseInt(val, 10))}
              />
            </div>
          </div>

          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <h3 className={styles.sectionTitle}>
                <Volume2 size={14} /> Voice &amp; TTS
              </h3>
              <span className={styles.voiceCount}>
                {enVoices.length} English voice{enVoices.length !== 1 ? 's' : ''} available
              </span>
            </div>
            <div className={styles.voiceRow}>
              <div className={styles.fieldGroup} style={{ flex: 1 }}>
                <label className={styles.apiLabel}>TTS Voice</label>
                <CustomSelect
                  value={ttsVoice}
                  placeholder="Best available (auto)"
                  options={[
                    { value: '', label: 'Best available (auto)' },
                    ...enVoices.map((v) => ({
                      value: v.name,
                      label: `${v.name}${v.lang !== 'en-US' ? ` [${v.lang}]` : ''}`,
                    })),
                  ]}
                  onChange={(val) => setTtsVoice(val)}
                />
              </div>
              <button onClick={testVoice} className={styles.testBtn}>
                <Volume2 size={14} /> Test
              </button>
            </div>
          </div>

          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Data Management</h3>
            <div className={styles.dataActions}>
              <button onClick={handleExport} className={styles.dataBtn}>
                <Download size={16} /> Export Data
              </button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImport}
                accept=".json"
                style={{ display: 'none' }}
              />
              <button onClick={() => fileInputRef.current?.click()} className={styles.dataBtn}>
                <Upload size={16} /> Import Data
              </button>
            </div>
            <button onClick={onClearChats} className={styles.wipeBtn}>
              Wipe All Conversations
            </button>
          </div>
        </div>

        <div className={styles.footer}>
          <button onClick={handleSave} className={styles.saveBtn}>
            Save &amp; Apply
          </button>
        </div>
      </div>
    </div>
  );
}
