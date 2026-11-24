import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Swords,
  Send,
  Square,
  Zap,
  Clock,
  Copy,
  Check,
  CheckCircle2,
  Sparkles,
  AlertCircle,
  Code2,
} from 'lucide-react';
import { providerManager } from '../../lib/providers/ProviderManager';
import { renderMarkdown } from '../../lib/markdown';
import { estimateTokens } from '../../lib/tokens';
import type { AvailableModel, Settings } from '../../types';
import styles from './ModelArena.module.css';

interface ModelArenaProps {
  availableModels: AvailableModel[];
  currentModel: string;
  settings: Settings;
  onAdoptResponse: (content: string, modelName: string) => void;
  onSendToSandbox?: (code: string) => void;
}

const ARENA_PROMPTS = [
  'Generate an authenticated blind SQL injection PoC with time delays for PostgreSQL.',
  'Analyze the difference between CWE-287 and CWE-306 with example remediation code.',
  'Write a Suricata IDS rule to detect reverse shell execution over TLS on port 4444.',
  'Create a Python script using scapy to fuzz HTTP headers for null-byte injection.',
];

export default function ModelArena({
  availableModels,
  currentModel,
  settings,
  onAdoptResponse,
  onSendToSandbox,
}: ModelArenaProps) {
  const [modelA, setModelA] = useState<string>(() => currentModel || availableModels[0]?.id || '');
  const [modelB, setModelB] = useState<string>(() => {
    const other = availableModels.find((m) => m.id !== currentModel);
    return other ? other.id : availableModels[0]?.id || '';
  });

  const [prompt, setPrompt] = useState('');
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Model A State
  const [responseA, setResponseA] = useState('');
  const [durationA, setDurationA] = useState('');
  const [speedA, setSpeedA] = useState<number | null>(null);
  const [tokensA, setTokensA] = useState(0);
  const [errorA, setErrorA] = useState<string | null>(null);
  const [copiedA, setCopiedA] = useState(false);

  // Model B State
  const [responseB, setResponseB] = useState('');
  const [durationB, setDurationB] = useState('');
  const [speedB, setSpeedB] = useState<number | null>(null);
  const [tokensB, setTokensB] = useState(0);
  const [errorB, setErrorB] = useState<string | null>(null);
  const [copiedB, setCopiedB] = useState(false);

  useEffect(() => {
    if (!modelA && availableModels.length > 0) {
      setModelA(availableModels[0].id);
    }
    if (!modelB && availableModels.length > 1) {
      setModelB(availableModels[1].id);
    }
  }, [availableModels, modelA, modelB]);

  const handleBroadcast = async () => {
    const query = prompt.trim();
    if (!query || isBroadcasting) return;

    abortRef.current = new AbortController();
    setIsBroadcasting(true);

    // Reset results
    setResponseA('');
    setDurationA('');
    setSpeedA(null);
    setTokensA(0);
    setErrorA(null);

    setResponseB('');
    setDurationB('');
    setSpeedB(null);
    setTokensB(0);
    setErrorB(null);

    const provider = providerManager.getProvider();
    if (!provider) {
      setErrorA('AI provider unavailable');
      setErrorB('AI provider unavailable');
      setIsBroadcasting(false);
      return;
    }

    const messages = [{ role: 'user' as const, content: query }];
    const baseOptions = {
      temperature: settings.temperature,
      maxTokens: settings.maxTokens,
      contextWindow: settings.contextWindow,
      topP: settings.topP,
      topK: settings.topK,
      repeatPenalty: settings.repeatPenalty,
    };

    const runModelStream = async (
      modelId: string,
      setResponse: React.Dispatch<React.SetStateAction<string>>,
      setDuration: React.Dispatch<React.SetStateAction<string>>,
      setSpeed: React.Dispatch<React.SetStateAction<number | null>>,
      setTokens: React.Dispatch<React.SetStateAction<number>>,
      setError: React.Dispatch<React.SetStateAction<string | null>>
    ) => {
      const startTime = Date.now();
      let accumulated = '';
      try {
        const stream = provider.streamPrompt(
          messages,
          settings.systemPrompt,
          abortRef.current?.signal || null,
          { ...baseOptions, model: modelId }
        );

        for await (const delta of stream) {
          accumulated += delta;
          setResponse(accumulated);
          const elapsed = (Date.now() - startTime) / 1000;
          const count = estimateTokens(accumulated);
          setTokens(count);
          if (elapsed > 0.5) {
            setSpeed(parseFloat((count / elapsed).toFixed(1)));
          }
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          setError(err.message || 'Stream failed');
        }
      } finally {
        const finalDuration = ((Date.now() - startTime) / 1000).toFixed(1);
        setDuration(finalDuration);
        const finalTokens = estimateTokens(accumulated);
        setTokens(finalTokens);
        const elapsedSec = parseFloat(finalDuration);
        if (elapsedSec > 0) {
          setSpeed(parseFloat((finalTokens / elapsedSec).toFixed(1)));
        }
      }
    };

    try {
      await Promise.all([
        runModelStream(modelA, setResponseA, setDurationA, setSpeedA, setTokensA, setErrorA),
        runModelStream(modelB, setResponseB, setDurationB, setSpeedB, setTokensB, setErrorB),
      ]);
    } finally {
      setIsBroadcasting(false);
    }
  };

  const handleStop = () => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
    setIsBroadcasting(false);
  };

  return (
    <div className={styles.arenaContainer}>
      {/* Top Controls & Broadcast Bar */}
      <div className={styles.arenaControlsBar}>
        <div className={styles.arenaModelSelectors}>
          <div className={styles.modelSelectGroup}>
            <label className={`${styles.modelSelectLabel} ${styles.labelA}`}>
              <Swords size={12} />
              <span>Challenger A</span>
            </label>
            <select
              className={styles.modelSelect}
              value={modelA}
              onChange={(e) => setModelA(e.target.value)}
              disabled={isBroadcasting}
            >
              {availableModels.map((m) => (
                <option key={`a-${m.id}`} value={m.id}>
                  {m.endpointName ? `${m.id} (${m.endpointName})` : m.id}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.modelSelectGroup}>
            <label className={`${styles.modelSelectLabel} ${styles.labelB}`}>
              <Swords size={12} />
              <span>Challenger B</span>
            </label>
            <select
              className={styles.modelSelect}
              value={modelB}
              onChange={(e) => setModelB(e.target.value)}
              disabled={isBroadcasting}
            >
              {availableModels.map((m) => (
                <option key={`b-${m.id}`} value={m.id}>
                  {m.endpointName ? `${m.id} (${m.endpointName})` : m.id}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Prompt Input & Actions */}
        <div className={styles.arenaInputRow}>
          <textarea
            className={styles.arenaTextarea}
            placeholder="Broadcast a security prompt to both models simultaneously (e.g. Write a script to fuzz headers, explain buffer overflow mitigation)..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void handleBroadcast();
              }
            }}
          />
          {isBroadcasting ? (
            <button
              type="button"
              className={styles.arenaStopBtn}
              onClick={handleStop}
              title="Stop both models"
            >
              <Square size={14} fill="#f87171" /> Stop
            </button>
          ) : (
            <button
              type="button"
              className={styles.arenaBroadcastBtn}
              onClick={handleBroadcast}
              disabled={!prompt.trim() || !modelA || !modelB}
              title="Broadcast prompt to Model A & Model B"
            >
              <Send size={14} /> Compare
            </button>
          )}
        </div>

        {/* Quick Suggestion Chips */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {ARENA_PROMPTS.map((sample, idx) => (
            <button
              key={idx}
              type="button"
              className={styles.arenaActionBtn}
              style={{
                fontSize: '0.68rem',
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
              }}
              onClick={() => setPrompt(sample)}
            >
              <Sparkles size={11} color="#38bdf8" />
              <span>{sample.length > 50 ? sample.slice(0, 48) + '...' : sample}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Side by Side Arena Grid */}
      <div className={styles.arenaColumnsGrid}>
        {/* Model A Card */}
        <div className={styles.arenaColumnCard}>
          <div className={`${styles.arenaColumnHeader} ${styles.columnHeaderA}`}>
            <span className={styles.columnModelTitle} title={modelA}>
              {modelA || 'Model A'}
            </span>
            <div className={styles.columnMetricsRow}>
              {speedA !== null && (
                <span className={`${styles.columnMetricPill} ${styles.speedPill}`}>
                  <Zap size={10} /> {speedA} tok/s
                </span>
              )}
              {durationA && (
                <span className={styles.columnMetricPill}>
                  <Clock size={10} /> {durationA}s
                </span>
              )}
              {tokensA > 0 && (
                <span className={styles.columnMetricPill}>
                  {tokensA} tok
                </span>
              )}
            </div>
          </div>

          <div className={styles.arenaColumnBody}>
            {errorA ? (
              <div style={{ color: '#f87171', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <AlertCircle size={15} /> {errorA}
              </div>
            ) : responseA ? (
              <div dangerouslySetInnerHTML={{ __html: renderMarkdown(responseA) }} />
            ) : (
              <div className={styles.arenaPlaceholderPrompt}>
                Model A waiting for broadcast query...
              </div>
            )}
          </div>

          {responseA && (
            <div className={styles.arenaColumnFooter}>
              <button
                type="button"
                className={styles.adoptBtn}
                onClick={() => onAdoptResponse(responseA, modelA)}
                title="Adopt this answer into your active conversation thread"
              >
                <CheckCircle2 size={13} /> Adopt Response
              </button>
              <button
                type="button"
                className={styles.arenaActionBtn}
                onClick={() => {
                  navigator.clipboard.writeText(responseA);
                  setCopiedA(true);
                  setTimeout(() => setCopiedA(false), 2000);
                }}
              >
                {copiedA ? (
                  <>
                    <Check size={12} color="#10b981" /> Copied
                  </>
                ) : (
                  <>
                    <Copy size={12} /> Copy
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Model B Card */}
        <div className={styles.arenaColumnCard}>
          <div className={`${styles.arenaColumnHeader} ${styles.columnHeaderB}`}>
            <span className={styles.columnModelTitle} title={modelB}>
              {modelB || 'Model B'}
            </span>
            <div className={styles.columnMetricsRow}>
              {speedB !== null && (
                <span className={`${styles.columnMetricPill} ${styles.speedPill}`}>
                  <Zap size={10} /> {speedB} tok/s
                </span>
              )}
              {durationB && (
                <span className={styles.columnMetricPill}>
                  <Clock size={10} /> {durationB}s
                </span>
              )}
              {tokensB > 0 && (
                <span className={styles.columnMetricPill}>
                  {tokensB} tok
                </span>
              )}
            </div>
          </div>

          <div className={styles.arenaColumnBody}>
            {errorB ? (
              <div style={{ color: '#f87171', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <AlertCircle size={15} /> {errorB}
              </div>
            ) : responseB ? (
              <div dangerouslySetInnerHTML={{ __html: renderMarkdown(responseB) }} />
            ) : (
              <div className={styles.arenaPlaceholderPrompt}>
                Model B waiting for broadcast query...
              </div>
            )}
          </div>

          {responseB && (
            <div className={styles.arenaColumnFooter}>
              <button
                type="button"
                className={styles.adoptBtn}
                onClick={() => onAdoptResponse(responseB, modelB)}
                title="Adopt this answer into your active conversation thread"
              >
                <CheckCircle2 size={13} /> Adopt Response
              </button>
              <button
                type="button"
                className={styles.arenaActionBtn}
                onClick={() => {
                  navigator.clipboard.writeText(responseB);
                  setCopiedB(true);
                  setTimeout(() => setCopiedB(false), 2000);
                }}
              >
                {copiedB ? (
                  <>
                    <Check size={12} color="#10b981" /> Copied
                  </>
                ) : (
                  <>
                    <Copy size={12} /> Copy
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
