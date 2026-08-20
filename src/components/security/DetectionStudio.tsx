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
import styles from './DetectionStudio.module.css';

interface DetectionStudioProps {
  onSendToAI?: (prompt: string) => void;
}

const SAMPLE_YARA = `rule Detect_Suspicious_PowerShell_WebClient {
    meta:
        description = "Detects hidden PowerShell download cradles attempting C2 execution"
        author = "Nexus Security AI"
        date = "2026-08-20"
        severity = "High"
        reference = "MITRE ATT&CK T1059.001"

    strings:
        $s1 = "Net.WebClient" nocase
        $s2 = "DownloadString(" nocase
        $s3 = "DownloadFile(" nocase
        $s4 = "-enc" nocase
        $s5 = "-ExecutionPolicy Bypass" nocase
        $s6 = "IEX" nocase
        $hex_magic = { 4D 5A 90 00 } // MZ Header

    condition:
        ($s1 and ($s2 or $s3) and ($s4 or $s5 or $s6)) or
        (2 of ($s*) and $hex_magic)
}`;

const SAMPLE_SIGMA = `title: Suspicious PowerShell Process with Encoded Command
id: 5a8a1b32-8492-4f9e-9d21-72fba17621c1
status: test
description: Detects execution of PowerShell with base64 encoded command parameters
references:
    - https://attack.mitre.org/techniques/T1059/001/
author: Nexus Security AI
date: 2026/08/20
logsource:
    category: process_creation
    product: windows
detection:
    selection:
        Image|endswith:
            - '\\powershell.exe'
            - '\\pwsh.exe'
        CommandLine|contains:
            - ' -e '
            - ' -enc '
            - ' -encodedcommand '
            - ' -ec '
    condition: selection
falsepositives:
    - Legitimate administrative automation scripts
level: high
tags:
    - attack.execution
    - attack.t1059.001`;

const STRIDE_CATEGORIES = [
  {
    threat: 'Spoofing (S)',
    description: 'Impersonating an identity, user, service, or server (e.g. session hijacking, weak tokens, lack of mTLS).',
    mitigation: 'Strong MFA, JWT signature validation, cryptographically bound sessions, mutual TLS.',
  },
  {
    threat: 'Tampering (T)',
    description: 'Modifying data in transit, in memory, or in storage without authorization (e.g. parameter tampering, MITM).',
    mitigation: 'HMAC/Digital signatures, TLS 1.3 encryption, database row-level hashing, input validation.',
  },
  {
    threat: 'Repudiation (R)',
    description: 'Claiming an action was not performed due to inadequate or tamperable audit logs.',
    mitigation: 'Immutable centralized SIEM audit logs, cryptographically signed audit trails, WORM storage.',
  },
  {
    threat: 'Information Disclosure (I)',
    description: 'Exposing confidential data to unauthorized parties (e.g. verbose errors, IDOR, SSRF, leaky APIs).',
    mitigation: 'Defense-in-depth authorization checks, field-level encryption, generic error handling, rate limiting.',
  },
  {
    threat: 'Denial of Service (D)',
    description: 'Exhausting resources to render a system or API unavailable (e.g. ReDoS, volumetric floods, DB connection exhaustion).',
    mitigation: 'Adaptive rate limiting, CAPTCHAs, connection pooling limits, timeout bounds, DDoS shielding.',
  },
  {
    threat: 'Elevation of Privilege (E)',
    description: 'Gaining unauthorized administrative or horizontal/vertical permissions.',
    mitigation: 'Principle of Least Privilege (PoLP), strict RBAC/ABAC enforcement, removing suid/admin binaries.',
  },
];

const YARA_STORAGE_KEY = 'nexus_security_yara';
const SIGMA_STORAGE_KEY = 'nexus_security_sigma';

export default function DetectionStudio({ onSendToAI }: DetectionStudioProps) {
  const [activeTab, setActiveTab] = useState<'yara' | 'sigma' | 'stride'>('yara');
  const [yaraCode, setYaraCode] = useState(() => {
    return localStorage.getItem(YARA_STORAGE_KEY) || SAMPLE_YARA;
  });
  const [sigmaCode, setSigmaCode] = useState(() => {
    return localStorage.getItem(SIGMA_STORAGE_KEY) || SAMPLE_SIGMA;
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

  const ruleCode = activeTab === 'yara' ? yaraCode : sigmaCode;
  const setRuleCode = (val: string) => {
    if (activeTab === 'yara') setYaraCode(val);
    else setSigmaCode(val);
  };

  const handleResetCurrent = () => {
    if (activeTab === 'yara') setYaraCode(SAMPLE_YARA);
    if (activeTab === 'sigma') setSigmaCode(SAMPLE_SIGMA);
  };

  const handleTabSwitch = (tab: 'yara' | 'sigma' | 'stride') => {
    setActiveTab(tab);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(ruleCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAIRequest = () => {
    if (!onSendToAI) return;
    if (activeTab === 'yara') {
      onSendToAI(
        `Please review and optimize this YARA rule, checking for false positive risks, syntax accuracy, and evasion bypasses:\n\`\`\`yara\n${ruleCode}\n\`\`\``
      );
    } else if (activeTab === 'sigma') {
      onSendToAI(
        `Please convert this Sigma rule into SIEM queries for:\n1. Splunk (SPL)\n2. Microsoft Sentinel (KQL)\n3. Elastic (EQL/KQL)\n\nSigma Rule:\n\`\`\`yaml\n${ruleCode}\n\`\`\``
      );
    }
  };

  return (
    <div className={styles.studioContainer}>
      <div className={styles.navRow}>
        <div className={styles.tabGroup}>
          <button
            className={`${styles.subTab} ${activeTab === 'yara' ? styles.active : ''}`}
            onClick={() => handleTabSwitch('yara')}
          >
            <Shield size={13} style={{ display: 'inline', marginRight: '4px' }} /> YARA Rule Builder
          </button>
          <button
            className={`${styles.subTab} ${activeTab === 'sigma' ? styles.active : ''}`}
            onClick={() => handleTabSwitch('sigma')}
          >
            <Database size={13} style={{ display: 'inline', marginRight: '4px' }} /> Sigma & SIEM Queries
          </button>
          <button
            className={`${styles.subTab} ${activeTab === 'stride' ? styles.active : ''}`}
            onClick={() => handleTabSwitch('stride')}
          >
            <Layers size={13} style={{ display: 'inline', marginRight: '4px' }} /> STRIDE Threat Model
          </button>
        </div>

        {activeTab !== 'stride' && (
          <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleAIRequest}>
            <Sparkles size={13} />
            {activeTab === 'yara' ? 'Review with Detection AI' : 'Convert to Splunk / KQL'}
          </button>
        )}
      </div>

      {activeTab === 'stride' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              STRIDE Threat Modeling Taxonomy & Mitigation Matrix
            </span>
            {onSendToAI && (
              <button
                className={`${styles.btn} ${styles.btnPrimary}`}
                onClick={() =>
                  onSendToAI(
                    'Please perform a complete STRIDE Threat Model analysis for my target system/API architecture. Break down trust boundaries, potential threat vectors for each category, and defensive mitigations.'
                  )
                }
              >
                <Sparkles size={13} /> Generate Threat Model with AI
              </button>
            )}
          </div>
          <div className={styles.strideGrid}>
            {STRIDE_CATEGORIES.map((item, idx) => (
              <div key={idx} className={styles.strideCard}>
                <span className={styles.strideTitle}>{item.threat}</span>
                <p className={styles.strideText}>
                  <strong>Threat:</strong> {item.description}
                </p>
                <p className={styles.strideText} style={{ color: '#a7f3d0' }}>
                  <strong>Mitigation:</strong> {item.mitigation}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className={styles.editorCard}>
          <div className={styles.cardHeader}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <FileCode size={14} />
              {activeTab === 'yara' ? 'YARA Rule Definition (.yar)' : 'Sigma Detection Rule (.yml)'}
            </span>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <button
                className={styles.btn}
                style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }}
                onClick={handleCopy}
              >
                {copied ? <Check size={11} /> : <Copy size={11} />}
                {copied ? 'Copied' : 'Copy'}
              </button>
              <button
                className={styles.btn}
                style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }}
                onClick={() =>
                  setRuleCode(activeTab === 'yara' ? SAMPLE_YARA : SAMPLE_SIGMA)
                }
              >
                <RotateCcw size={11} /> Reset
              </button>
            </div>
          </div>
          <textarea
            className={styles.codeArea}
            value={ruleCode}
            onChange={(e) => setRuleCode(e.target.value)}
            spellCheck={false}
          />
        </div>
      )}
    </div>
  );
}
