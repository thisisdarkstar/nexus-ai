import { useState, useEffect } from 'react';
import {
  Sparkles,
  Copy,
  Check,
  FileCode,
  Shield,
  Layers,
  Database,
  RotateCcw,
} from 'lucide-react';
import {
  SAMPLE_YARA,
  SAMPLE_SIGMA,
  STRIDE_CATEGORIES,
} from '../../data/security/detectionTemplates';
import styles from './DetectionStudio.module.css';

interface DetectionStudioProps {
  onSendToAI?: (prompt: string) => void;
}

const YARA_STORAGE_KEY = 'nexus_security_yara';
const SIGMA_STORAGE_KEY = 'nexus_security_sigma';
const DETECTION_TAB_STORAGE_KEY = 'nexus_security_detection_tab';

export default function DetectionStudio({ onSendToAI }: DetectionStudioProps) {
  const [activeTab, setActiveTab] = useState<'yara' | 'sigma' | 'stride'>(() => {
    try { return (localStorage.getItem(DETECTION_TAB_STORAGE_KEY) as 'yara' | 'sigma' | 'stride') || 'yara'; } catch { return 'yara'; }
  });
  const [yaraCode, setYaraCode] = useState(() => {
    try { return localStorage.getItem(YARA_STORAGE_KEY) || SAMPLE_YARA; } catch { return SAMPLE_YARA; }
  });
  const [sigmaCode, setSigmaCode] = useState(() => {
    try { return localStorage.getItem(SIGMA_STORAGE_KEY) || SAMPLE_SIGMA; } catch { return SAMPLE_SIGMA; }
  });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(YARA_STORAGE_KEY, yaraCode);
    } catch (e) {
      console.error(e);
    }
  }, [yaraCode]);

  useEffect(() => {
    try {
      localStorage.setItem(SIGMA_STORAGE_KEY, sigmaCode);
    } catch (e) {
      console.error(e);
    }
  }, [sigmaCode]);

  useEffect(() => {
    try {
      localStorage.setItem(DETECTION_TAB_STORAGE_KEY, activeTab);
    } catch (e) {
      console.error(e);
    }
  }, [activeTab]);

  const ruleCode = activeTab === 'yara' ? yaraCode : sigmaCode;
  const setRuleCode = (val: string) => {
    if (activeTab === 'yara') setYaraCode(val);
    else setSigmaCode(val);
  };

  const handleResetCurrent = () => {
    if (activeTab === 'yara') setYaraCode(SAMPLE_YARA);
    if (activeTab === 'sigma') setSigmaCode(SAMPLE_SIGMA);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(ruleCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAIDetect = () => {
    if (!onSendToAI) return;
    const prompt =
      activeTab === 'yara'
        ? `Review and optimize this YARA rule for high-fidelity detection without false positives:\n\n\`\`\`yara\n${yaraCode}\n\`\`\`\n\nProvide:\n1. Rule logic critique & optimization\n2. False positive risk analysis\n3. Suggested hex/regex improvements`
        : activeTab === 'sigma'
          ? `Review and convert this Sigma detection rule into Splunk, Elastic, and Microsoft Sentinel queries:\n\n\`\`\`yaml\n${sigmaCode}\n\`\`\``
          : `Provide an in-depth Threat Model (STRIDE) analysis for modern Web and Cloud API architectures with concrete defensive mitigation steps.`;
    onSendToAI(prompt);
  };

  return (
    <div className={styles.studioContainer}>
      {/* Top Header & Tabs */}
      <div className={styles.topBar}>
        <div className={styles.tabGroup}>
          <button
            className={`${styles.tabBtn} ${activeTab === 'yara' ? styles.active : ''}`}
            onClick={() => setActiveTab('yara')}
          >
            <FileCode size={13} /> YARA Scanner &amp; Rule Builder
          </button>
          <button
            className={`${styles.tabBtn} ${activeTab === 'sigma' ? styles.active : ''}`}
            onClick={() => setActiveTab('sigma')}
          >
            <Layers size={13} /> Sigma SIEM Rule Hub
          </button>
          <button
            className={`${styles.tabBtn} ${activeTab === 'stride' ? styles.active : ''}`}
            onClick={() => setActiveTab('stride')}
          >
            <Shield size={13} /> STRIDE Threat Modeling
          </button>
        </div>

        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
          {activeTab !== 'stride' && (
            <>
              <button className={styles.btn} onClick={handleResetCurrent} title="Reset to Sample Rule">
                <RotateCcw size={12} /> Reset
              </button>
              <button className={styles.btn} onClick={handleCopy}>
                {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? 'Copied' : 'Copy'}
              </button>
            </>
          )}
          {onSendToAI && (
            <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleAIDetect}>
              <Sparkles size={13} /> AI Detection Engineer
            </button>
          )}
        </div>
      </div>

      {activeTab !== 'stride' ? (
        <div className={styles.editorCard}>
          <div className={styles.cardHeader}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Database size={14} color="var(--accent-color)" />
              {activeTab === 'yara' ? 'YARA Rule Definition (YARA v4.x)' : 'Sigma Generic Rule (YAML v2)'}
            </span>
            <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
              {activeTab === 'yara' ? 'Syntax: YARA Pattern Matching' : 'Standard: MITRE ATT&CK Mapped'}
            </span>
          </div>
          <textarea
            className={styles.codeArea}
            value={ruleCode}
            onChange={(e) => setRuleCode(e.target.value)}
            spellCheck={false}
          />
        </div>
      ) : (
        <div className={styles.strideGrid}>
          {STRIDE_CATEGORIES.map((cat, idx) => (
            <div key={idx} className={styles.strideCard}>
              <div className={styles.strideTitle}>{cat.threat}</div>
              <p className={styles.strideDesc}>{cat.description}</p>
              <div className={styles.strideMitigation}>
                <strong>Mitigation:</strong> {cat.mitigation}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
