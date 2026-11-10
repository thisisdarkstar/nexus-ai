import { useState, useEffect, useRef, useMemo } from 'react';
import {
  X,
  Download,
  Upload,
  Monitor,
  Volume2,
  Server,
  Wifi,
  Trash2,
  Eye,
  EyeOff,
  Plus,
  RotateCw,
} from 'lucide-react';
import CustomSelect from './common/CustomSelect';
import { db } from '../lib/db';
import { DEFAULT_OPENAI_BASE_URL, DEFAULT_OPENAI_ENDPOINTS } from '../lib/constants';
import { useToast } from '../lib/toast';
import type { Settings, OpenAIEndpoint, AvailableModel } from '../types';
import styles from './SettingsModal.module.css';

const PROVIDER_OPTIONS: Array<{ value: Settings['provider']; label: string }> = [
  { value: 'chrome', label: 'Chrome Gemini Nano (Local Built-in)' },
  { value: 'openai', label: 'OpenAI-Compatible Providers (Multi-Endpoint)' },
];

const THEME_OPTIONS: Array<{ value: Settings['theme']; label: string }> = [
  { value: 'dark', label: 'Deep Nebula (Dark)' },
  { value: 'light', label: 'Clear Sky (Light)' },
];

const MAX_TOKENS_OPTIONS = [
  { value: '1024', label: '1,024 - Short responses' },
  { value: '2048', label: '2,048 - Standard' },
  { value: '4096', label: '4,096 - Detailed (default)' },
  { value: '8192', label: '8,192 - Long code / analysis' },
  { value: '16384', label: '16,384 - Very long outputs' },
  { value: '32768', label: '32,768 - Maximum' },
];

const PRESET_DEFINITIONS: Record<string, { name: string; baseUrl: string; apiKey: string }> = {
  ollama: { name: 'Ollama (Local)', baseUrl: 'http://localhost:11434/v1', apiKey: 'sk-local' },
  lmstudio: { name: 'LM Studio (Local)', baseUrl: 'http://localhost:1234/v1', apiKey: 'sk-local' },
  openrouter: { name: 'OpenRouter (Cloud)', baseUrl: 'https://openrouter.ai/api/v1', apiKey: '' },
  groq: { name: 'Groq Cloud', baseUrl: 'https://api.groq.com/openai/v1', apiKey: '' },
  deepseek: { name: 'DeepSeek API', baseUrl: 'https://api.deepseek.com/v1', apiKey: '' },
  openai: { name: 'OpenAI Official', baseUrl: 'https://api.openai.com/v1', apiKey: '' },
  custom: { name: 'Custom OpenAI-Compatible', baseUrl: 'http://localhost:8000/v1', apiKey: '' },
};

const PRESET_SELECT_OPTIONS = [
  { value: 'ollama', label: 'Preset: Ollama (localhost:11434)' },
  { value: 'lmstudio', label: 'Preset: LM Studio (localhost:1234)' },
  { value: 'openrouter', label: 'Preset: OpenRouter (openrouter.ai)' },
  { value: 'groq', label: 'Preset: Groq Cloud (api.groq.com)' },
  { value: 'deepseek', label: 'Preset: DeepSeek (api.deepseek.com)' },
  { value: 'openai', label: 'Preset: OpenAI Official (api.openai.com)' },
  { value: 'custom', label: 'Custom Endpoint...' },
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
  const { toast } = useToast();
  const [provider, setProvider] = useState<Settings['provider']>(settings.provider || 'chrome');
  const [theme, setTheme] = useState<Settings['theme']>(settings.theme || 'dark');
  const [systemPrompt, setSystemPrompt] = useState(settings.systemPrompt || '');
  const [temperature, setTemperature] = useState(settings.temperature ?? 0.7);
  const [maxTokens, setMaxTokens] = useState(settings.maxTokens ?? 4096);
  const [ttsVoice, setTtsVoice] = useState(settings.ttsVoice || '');

  // Multi-endpoint state
  const [endpoints, setEndpoints] = useState<OpenAIEndpoint[]>(() => {
    if (settings.endpoints && settings.endpoints.length > 0) {
      return settings.endpoints;
    }
    if (settings.openaiBaseUrl && settings.openaiBaseUrl !== DEFAULT_OPENAI_BASE_URL) {
      return [
        {
          id: 'primary',
          name: 'Custom Endpoint',
          baseUrl: settings.openaiBaseUrl,
          apiKey: settings.openaiApiKey || 'sk-local',
          enabled: true,
        },
        ...DEFAULT_OPENAI_ENDPOINTS.filter((e) => e.id !== 'ollama'),
      ];
    }
    return DEFAULT_OPENAI_ENDPOINTS;
  });

  const [activeEndpointId, setActiveEndpointId] = useState<string>(
    settings.activeEndpointId || endpoints[0]?.id || 'ollama'
  );

  const [openaiModel, setOpenaiModel] = useState(settings.openaiModel || '');
  const [availableModels, setAvailableModels] = useState<AvailableModel[]>([]);
  const [showApiKey, setShowApiKey] = useState<Record<string, boolean>>({});
  const [testStatus, setTestStatus] = useState<
    Record<
      string,
      { status: 'idle' | 'testing' | 'online' | 'error'; latency?: number; modelCount?: number; reason?: string }
    >
  >({});
  const [presetToAdd, setPresetToAdd] = useState<string>('ollama');

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

  // Fetch models across enabled endpoints
  useEffect(() => {
    if (provider === 'openai') {
      const fetchAll = async () => {
        const enabled = endpoints.filter((e) => e.enabled !== false);
        const results = await Promise.allSettled(
          enabled.map(async (ep) => {
            const res = await fetch(`${ep.baseUrl}/models`, {
              headers: ep.apiKey ? { Authorization: `Bearer ${ep.apiKey}` } : {},
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            const list = data.data || [];
            return list.map((m: any) => ({
              id: m.id,
              endpointId: ep.id,
              endpointName: ep.name,
            }));
          })
        );
        const all: AvailableModel[] = [];
        results.forEach((r) => {
          if (r.status === 'fulfilled' && Array.isArray(r.value)) {
            all.push(...r.value);
          }
        });
        if (all.length > 0) {
          setAvailableModels(all);
          if (!openaiModel) {
            setOpenaiModel(all[0].id);
          }
        }
      };
      fetchAll();
    }
  }, [provider, endpoints]);

  const handleTestEndpoint = async (ep: OpenAIEndpoint) => {
    setTestStatus((prev) => ({
      ...prev,
      [ep.id]: { status: 'testing' },
    }));
    const startTime = performance.now();
    try {
      const res = await fetch(`${ep.baseUrl}/models`, {
        headers: ep.apiKey ? { Authorization: `Bearer ${ep.apiKey}` } : {},
      });
      const latency = Math.round(performance.now() - startTime);
      if (res.ok) {
        const data = await res.json();
        const list = data.data || [];
        const count = list.length;
        setTestStatus((prev) => ({
          ...prev,
          [ep.id]: { status: 'online', latency, modelCount: count },
        }));
        toast('success', `${ep.name}: Connected (${latency}ms, ${count} models)`);
        setAvailableModels((prev) => {
          const others = prev.filter((m) => m.endpointId !== ep.id);
          const newModels = list.map((m: any) => ({
            id: m.id,
            endpointId: ep.id,
            endpointName: ep.name,
          }));
          return [...others, ...newModels];
        });
      } else {
        setTestStatus((prev) => ({
          ...prev,
          [ep.id]: { status: 'error', reason: `HTTP ${res.status}` },
        }));
        toast('error', `${ep.name}: HTTP ${res.status}`);
      }
    } catch {
      setTestStatus((prev) => ({
        ...prev,
        [ep.id]: { status: 'error', reason: 'Unreachable' },
      }));
      toast('error', `${ep.name}: Unreachable. Ensure server is running.`);
    }
  };

  const handleAddEndpoint = () => {
    const preset = PRESET_DEFINITIONS[presetToAdd] || PRESET_DEFINITIONS.custom;
    const newEp: OpenAIEndpoint = {
      id: `ep-${Date.now()}`,
      name: preset.name,
      baseUrl: preset.baseUrl,
      apiKey: preset.apiKey,
      enabled: true,
    };
    setEndpoints((prev) => [...prev, newEp]);
    toast('info', `Added '${newEp.name}' endpoint`);
  };

  const handleDeleteEndpoint = (id: string) => {
    if (endpoints.length <= 1) {
      toast('warning', 'You must keep at least one endpoint');
      return;
    }
    const target = endpoints.find((e) => e.id === id);
    setEndpoints((prev) => prev.filter((e) => e.id !== id));
    if (activeEndpointId === id) {
      const remaining = endpoints.filter((e) => e.id !== id);
      if (remaining.length > 0) {
        setActiveEndpointId(remaining[0].id);
      }
    }
    toast('info', `Removed '${target?.name || 'endpoint'}'`);
  };

  const handleUpdateEndpoint = (id: string, updates: Partial<OpenAIEndpoint>) => {
    setEndpoints((prev) =>
      prev.map((e) => (e.id === id ? { ...e, ...updates } : e))
    );
  };

  const handleSave = () => {
    const activeEp = endpoints.find((e) => e.id === activeEndpointId) || endpoints[0];
    onSave({
      provider,
      theme,
      systemPrompt,
      endpoints,
      activeEndpointId,
      openaiBaseUrl: activeEp?.baseUrl || DEFAULT_OPENAI_BASE_URL,
      openaiApiKey: activeEp?.apiKey || 'sk-local',
      openaiModel,
      temperature: parseFloat(String(temperature)),
      maxTokens: parseInt(String(maxTokens), 10),
      ttsVoice,
    });
    toast('success', 'AI & System settings applied successfully');
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
        toast('success', 'Import successful!');
        if (reloadChats) reloadChats();
      } catch (err) {
        toast('error', 'Import failed: ' + (err instanceof Error ? err.message : String(err)));
      }
    };
    reader.readAsText(file);
  };

  const modelSelectOptions = useMemo(() => {
    if (availableModels.length === 0) {
      return [{ value: '', label: 'No models found across enabled endpoints' }];
    }
    return availableModels.map((m) => ({
      value: m.id,
      label: `${m.id} (${m.endpointName || 'Endpoint'})`,
    }));
  }, [availableModels]);

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-label="System Configuration"
        onClick={(e) => e.stopPropagation()}
      >
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
              <label className={styles.fieldLabel}>AI Execution Engine</label>
              <CustomSelect<Settings['provider']>
                value={provider}
                onChange={setProvider}
                options={PROVIDER_OPTIONS}
              />
            </div>
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Theme</label>
              <CustomSelect<Settings['theme']>
                value={theme}
                onChange={setTheme}
                options={THEME_OPTIONS}
              />
            </div>
          </div>

          {/* OpenAI-Compatible Multi-Endpoint Manager */}
          {provider === 'openai' && (
            <div className={styles.endpointsContainer}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className={styles.apiSectionTitle} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Server size={14} color="#38bdf8" /> OpenAI-Compatible Endpoints ({endpoints.length})
                </span>
                <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                  Select active default &amp; test connectivity
                </span>
              </div>

              <div className={styles.endpointList}>
                {endpoints.map((ep) => {
                  const isActive = ep.id === activeEndpointId;
                  const test = testStatus[ep.id];
                  const showingKey = !!showApiKey[ep.id];

                  return (
                    <div
                      key={ep.id}
                      className={`${styles.endpointCard} ${isActive ? styles.endpointCardActive : ''}`}
                    >
                      <div className={styles.endpointTopRow}>
                        <div className={styles.endpointLeft}>
                          <input
                            type="radio"
                            name="activeEndpoint"
                            checked={isActive}
                            onChange={() => setActiveEndpointId(ep.id)}
                            className={styles.endpointRadio}
                            title="Set as active default endpoint"
                          />
                          <input
                            type="text"
                            value={ep.name}
                            onChange={(e) => handleUpdateEndpoint(ep.id, { name: e.target.value })}
                            className={styles.endpointNameInput}
                            placeholder="Endpoint Name"
                          />
                          {test?.status === 'online' && (
                            <span className={`${styles.statusPill} ${styles.statusOnline}`}>
                              ● Online ({test.latency}ms • {test.modelCount} models)
                            </span>
                          )}
                          {test?.status === 'testing' && (
                            <span className={`${styles.statusPill} ${styles.statusTesting}`}>
                              ● Testing ping...
                            </span>
                          )}
                          {test?.status === 'error' && (
                            <span className={`${styles.statusPill} ${styles.statusError}`}>
                              ● {test.reason || 'Failed'}
                            </span>
                          )}
                          {(!test || test.status === 'idle') && (
                            <span className={`${styles.statusPill} ${styles.statusIdle}`}>
                              {ep.enabled !== false ? 'Enabled' : 'Disabled'}
                            </span>
                          )}
                        </div>

                        <div className={styles.endpointActions}>
                          <button
                            type="button"
                            className={styles.testConnectionBtn}
                            onClick={() => handleTestEndpoint(ep)}
                            title="Ping /models endpoint to verify connectivity and latency"
                          >
                            <Wifi size={12} /> Test
                          </button>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', color: '#94a3b8', cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={ep.enabled !== false}
                              onChange={(e) => handleUpdateEndpoint(ep.id, { enabled: e.target.checked })}
                            />
                            On
                          </label>
                          {endpoints.length > 1 && (
                            <button
                              type="button"
                              className={styles.endpointDeleteBtn}
                              onClick={() => handleDeleteEndpoint(ep.id)}
                              title="Delete endpoint"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </div>

                      <div className={styles.endpointGrid}>
                        <div className={styles.apiField}>
                          <label className={styles.apiLabel}>Base URL</label>
                          <input
                            value={ep.baseUrl}
                            onChange={(e) => handleUpdateEndpoint(ep.id, { baseUrl: e.target.value })}
                            className={styles.apiInput}
                            placeholder="http://localhost:11434/v1"
                          />
                        </div>

                        <div className={styles.apiField}>
                          <label className={styles.apiLabel}>API Key</label>
                          <div className={styles.apiKeyWrapper}>
                            <input
                              type={showingKey ? 'text' : 'password'}
                              value={ep.apiKey}
                              onChange={(e) => handleUpdateEndpoint(ep.id, { apiKey: e.target.value })}
                              className={styles.apiInput}
                              placeholder="sk-local or secret key"
                              style={{ width: '100%', paddingRight: '28px' }}
                            />
                            <button
                              type="button"
                              className={styles.apiKeyToggle}
                              onClick={() => setShowApiKey((prev) => ({ ...prev, [ep.id]: !showingKey }))}
                              title={showingKey ? 'Hide API Key' : 'Reveal API Key'}
                            >
                              {showingKey ? <EyeOff size={13} /> : <Eye size={13} />}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Add Endpoint Bar */}
              <div className={styles.addEndpointBar}>
                <div style={{ flex: 1, minWidth: '200px' }}>
                  <CustomSelect
                    value={presetToAdd}
                    onChange={(val) => setPresetToAdd(val)}
                    options={PRESET_SELECT_OPTIONS}
                    style={{ fontSize: '0.76rem' }}
                  />
                </div>
                <button
                  type="button"
                  className={styles.addEndpointBtn}
                  onClick={handleAddEndpoint}
                >
                  <Plus size={14} /> Add Endpoint
                </button>
              </div>

              {/* Default Model Selector */}
              <div className={styles.apiField} style={{ marginTop: '4px' }}>
                <label className={styles.apiLabel} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Default AI Model</span>
                  <span style={{ color: '#38bdf8' }}>{availableModels.length} models discovered</span>
                </label>
                <CustomSelect
                  value={openaiModel}
                  onChange={setOpenaiModel}
                  placeholder="Select default model..."
                  options={modelSelectOptions}
                />
              </div>
            </div>
          )}

          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>Global System Prompt</label>
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="e.g. You are an expert application security engineer..."
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
                onChange={(val) => setMaxTokens(parseInt(val, 10))}
                options={MAX_TOKENS_OPTIONS}
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
              <div className={styles.fieldGroup}>
                <label className={styles.apiLabel}>TTS Voice</label>
                <CustomSelect
                  value={ttsVoice}
                  onChange={setTtsVoice}
                  placeholder="Best available (auto)"
                  options={[
                    { value: '', label: 'Best available (auto)' },
                    ...enVoices.map((v) => ({
                      value: v.name,
                      label: `${v.name}${v.lang !== 'en-US' ? ` [${v.lang}]` : ''}`,
                    })),
                  ]}
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
