import { useState, useRef, useEffect } from 'react';
import {
  ShieldAlert,
  Terminal,
  Binary,
  Layers,
  FileText,
  Target,
  CheckSquare,
  Globe,
  Radio,
  Search,
  FileCode,
  Sparkles,
  X,
  Maximize2,
  Minimize2,
  ChevronDown,
  Check,
} from 'lucide-react';
import CodeAuditor from './CodeAuditor';
import SandboxTerminal from './SandboxTerminal';
import DecoderHub from './DecoderHub';
import DetectionStudio from './DetectionStudio';
import ReportStudio from './ReportStudio';
import ScopeManager from './ScopeManager';
import ChecklistTracker from './ChecklistTracker';
import HttpStudio from './HttpStudio';
import PayloadCrafter from './PayloadCrafter';
import ReconHub from './ReconHub';
import NucleiStudio from './NucleiStudio';
import type { SecurityTab } from '../../types';
import styles from './SecurityCanvas.module.css';

interface SecurityCanvasProps {
  activeTab: SecurityTab;
  onTabChange: (tab: SecurityTab) => void;
  onClose?: () => void;
  onSendToAI?: (prompt: string) => void;
  initialCode?: string;
  initialDecoderInput?: string;
}

type TabCategory = 'all' | 'assess' | 'web' | 'recon' | 'defense';

interface TabItem {
  id: SecurityTab;
  name: string;
  category: TabCategory;
  icon: React.ComponentType<{ size?: number; color?: string; className?: string }>;
  tooltip: string;
}

const CATEGORIES: Array<{ id: TabCategory; label: string }> = [
  { id: 'assess', label: 'Assessment & Scope' },
  { id: 'web', label: 'Web & Exploits' },
  { id: 'recon', label: 'Recon & Automation' },
  { id: 'defense', label: 'Code & Defense' },
];

const SECURITY_TABS: TabItem[] = [
  // Assess
  { id: 'reports', name: 'Reports', category: 'assess', icon: FileText, tooltip: 'VAPT & Bug Bounty Report Studio (CVSS Calculator)' },
  { id: 'scope', name: 'Scope', category: 'assess', icon: Target, tooltip: 'Target Scope & Asset Matrix' },
  { id: 'checklists', name: 'Checklists', category: 'assess', icon: CheckSquare, tooltip: 'OWASP WSTG v4.2 & API Checklist' },

  // Web & Exploits
  { id: 'http_studio', name: 'HTTP Studio', category: 'web', icon: Globe, tooltip: 'Burp Request Parser, cURL/Python Converter & Fuzzing' },
  { id: 'payloads', name: 'Payloads', category: 'web', icon: Radio, tooltip: 'Reverse Shell Generator, SSRF Cloud & SSTI Matrix' },
  { id: 'decoders', name: 'Decoders', category: 'web', icon: Binary, tooltip: 'JWT Inspector, Encoders & Hashes' },

  // Recon & Automation
  { id: 'recon', name: 'Recon Hub', category: 'recon', icon: Search, tooltip: 'Recon CLI Tool Chains & Google/GitHub Dorks' },
  { id: 'nuclei', name: 'Nuclei Studio', category: 'recon', icon: FileCode, tooltip: 'Nuclei v3 YAML Template Builder' },
  { id: 'sandbox', name: 'Sandbox', category: 'recon', icon: Terminal, tooltip: 'In-Browser Python Wasm Runtime' },

  // Code & Defense
  { id: 'auditor', name: 'SAST Audit', category: 'defense', icon: ShieldAlert, tooltip: 'Static Vulnerability Code Auditor' },
  { id: 'threat_studio', name: 'Threat Studio', category: 'defense', icon: Layers, tooltip: 'Sigma Rules & STRIDE Threat Modeler' },
];

export default function SecurityCanvas({
  activeTab,
  onTabChange,
  onClose,
  onSendToAI = () => {},
  initialCode,
  initialDecoderInput,
}: SecurityCanvasProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [category, setCategory] = useState<TabCategory>('all');
  const [sandboxCode, setSandboxCode] = useState<string | undefined>(undefined);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [dropdownOpen]);

  const handleSendToSandbox = (code: string) => {
    setSandboxCode(code);
    onTabChange('sandbox');
  };

  const activeTabInfo = SECURITY_TABS.find((t) => t.id === activeTab);
  const ActiveIcon = activeTabInfo?.icon || ShieldAlert;

  const handleAskAIWithActiveContext = () => {
    const tabName = activeTabInfo ? activeTabInfo.name : activeTab;
    
    let prompt = `I am currently using the **${tabName}** module in the Nexus Security Workbench.\n\n`;

    if (activeTab === 'decoders') {
      prompt += `I am analyzing security artifacts, encoding schemes, hashes, and JWT tokens in the Decoders & JWT Hub. Please help me deobfuscate unknown payloads, analyze token signatures/claims, or identify hash types.`;
    } else if (activeTab === 'http_studio') {
      prompt += `I am inspecting and transforming HTTP requests in the HTTP Studio. Please guide me on identifying API vulnerabilities (BOLA/IDOR, injections, missing headers) and generating test payloads.`;
    } else if (activeTab === 'payloads') {
      prompt += `I am crafting exploit payloads, reverse shells, SSRF cloud metadata bypasses, and SSTI matrices. Help me tailor and troubleshoot payloads for this target.`;
    } else if (activeTab === 'recon') {
      prompt += `I am conducting reconnaissance and OSINT in the Recon Hub. Suggest advanced search queries, automation tool pipelines, and asset enumeration strategies.`;
    } else if (activeTab === 'nuclei') {
      prompt += `I am building and debugging ProjectDiscovery Nuclei v3 YAML vulnerability templates. Guide me on writing accurate matchers, extractors, and syntax rules.`;
    } else if (activeTab === 'reports') {
      prompt += `I am drafting a VAPT / Bug Bounty pentest report in Report Studio. Help me calculate accurate CVSS v3.1 base scores, write executive summaries, and format remediation steps.`;
    } else if (activeTab === 'scope') {
      prompt += `I am mapping target scope and technologies in Scope Manager. Provide a tailored penetration testing methodology for these assets.`;
    } else if (activeTab === 'checklists') {
      prompt += `I am tracking vulnerability testing against OWASP WSTG v4.2 and API Security Top 10. Help guide testing procedures for my active checklist items.`;
    } else if (activeTab === 'auditor') {
      prompt += `I am performing static application security testing (SAST) in Code Auditor. Analyze the code for CWE vulnerabilities, business logic bugs, and provide secure diff patches.`;
    } else if (activeTab === 'sandbox') {
      prompt += `I am executing and debugging Python security scripts in the Pyodide WebAssembly Sandbox. Help me write and troubleshoot security tooling code.`;
    } else if (activeTab === 'threat_studio') {
      prompt += `I am creating Sigma detection rules and STRIDE threat models. Assist with detection logic, MITRE ATT&CK mapping, and mitigation strategies.`;
    }

    onSendToAI(prompt);
  };

  const filteredTabs = SECURITY_TABS.filter(
    (t) => category === 'all' || t.category === category
  );

  return (
    <div
      className={styles.canvasContainer}
      style={
        isFullscreen
          ? {
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 9999,
              width: '100vw',
              height: '100vh',
            }
          : undefined
      }
    >
      {/* Canvas Header & Tabs */}
      <div className={styles.canvasHeader}>
        {/* Category Pills */}
        <div className={styles.categoryGroup}>
          {(['all', 'assess', 'web', 'recon', 'defense'] as const).map((cat) => (
            <button
              key={cat}
              className={`${styles.catBtn} ${category === cat ? styles.active : ''}`}
              onClick={() => setCategory(cat)}
            >
              {cat === 'all' ? 'All' : cat === 'assess' ? 'Assess' : cat === 'web' ? 'Web' : cat === 'recon' ? 'Recon' : 'Defense'}
            </button>
          ))}
        </div>

        {/* Custom Rich Dropdown Selector for Narrow Views */}
        <div className={styles.dropdownWrapper} ref={dropdownRef}>
          <button
            type="button"
            className={`${styles.dropdownTrigger} ${dropdownOpen ? styles.dropdownTriggerActive : ''}`}
            onClick={() => setDropdownOpen(!dropdownOpen)}
            title="Select Security Tool"
          >
            <div className={styles.dropdownTriggerContent}>
              <ActiveIcon size={14} color="#10b981" />
              <span className={styles.dropdownTriggerLabel}>{activeTabInfo?.name || 'Tools'}</span>
            </div>
            <ChevronDown
              size={13}
              className={`${styles.dropdownChevron} ${dropdownOpen ? styles.dropdownChevronOpen : ''}`}
            />
          </button>

          {dropdownOpen && (
            <div className={styles.dropdownMenu}>
              {CATEGORIES.map((cat) => {
                const tabsInCat = SECURITY_TABS.filter((t) => t.category === cat.id);
                return (
                  <div key={cat.id} className={styles.dropdownGroup}>
                    <div className={styles.dropdownGroupHeader}>{cat.label}</div>
                    <div className={styles.dropdownGroupItems}>
                      {tabsInCat.map((t) => {
                        const Icon = t.icon;
                        const isActive = activeTab === t.id;
                        return (
                          <button
                            key={t.id}
                            type="button"
                            className={`${styles.dropdownItem} ${isActive ? styles.dropdownItemActive : ''}`}
                            onClick={() => {
                              onTabChange(t.id);
                              setDropdownOpen(false);
                            }}
                            title={t.tooltip}
                          >
                            <div className={styles.dropdownItemLeft}>
                              <Icon size={14} className={styles.dropdownItemIcon} />
                              <span className={styles.dropdownItemText}>{t.name}</span>
                            </div>
                            {isActive && <Check size={12} className={styles.dropdownItemCheck} />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Tab Switcher List */}
        <div className={styles.tabList}>
          {filteredTabs.map((t) => {
            const Icon = t.icon;
            const isActive = activeTab === t.id;
            return (
              <button
                key={t.id}
                className={`${styles.tabBtn} ${isActive ? styles.active : ''}`}
                onClick={() => onTabChange(t.id)}
                title={t.tooltip}
              >
                <Icon size={14} />
                <span>{t.name}</span>
              </button>
            );
          })}
        </div>

        {/* Action Controls */}
        <div className={styles.controlsGroup}>
          <button
            className={styles.aiCoPilotBtn}
            onClick={handleAskAIWithActiveContext}
            title="Ask AI with automatic context of active tool and current inputs"
          >
            <Sparkles size={13} />
            <span>Ask AI</span>
          </button>

          <button
            className={styles.iconBtn}
            onClick={() => setIsFullscreen(!isFullscreen)}
            title={isFullscreen ? 'Exit Fullscreen' : 'Maximize Canvas'}
          >
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>

          {onClose && (
            <button className={styles.iconBtn} onClick={onClose} title="Close Security Workbench">
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Tab Panels */}
      <div className={styles.tabContent}>
        {activeTab === 'auditor' && (
          <CodeAuditor
            initialCode={initialCode}
            onSendToAI={onSendToAI}
          />
        )}

        {activeTab === 'sandbox' && (
          <SandboxTerminal
            initialCode={sandboxCode}
            onSendToAI={onSendToAI}
          />
        )}

        {activeTab === 'decoders' && (
          <DecoderHub
            initialInput={initialDecoderInput}
            onSendToSandbox={handleSendToSandbox}
            onSendToAI={onSendToAI}
          />
        )}

        {activeTab === 'threat_studio' && (
          <DetectionStudio
            onSendToAI={onSendToAI}
          />
        )}

        {activeTab === 'reports' && (
          <ReportStudio
            onSendToAI={onSendToAI}
          />
        )}

        {activeTab === 'scope' && (
          <ScopeManager
            onSendToAI={onSendToAI}
          />
        )}

        {activeTab === 'checklists' && (
          <ChecklistTracker
            onSendToAI={onSendToAI}
          />
        )}

        {activeTab === 'http_studio' && (
          <HttpStudio
            onSendToAI={onSendToAI}
          />
        )}

        {activeTab === 'payloads' && (
          <PayloadCrafter
            onSendToAI={onSendToAI}
          />
        )}

        {activeTab === 'recon' && (
          <ReconHub
            onSendToAI={onSendToAI}
          />
        )}

        {activeTab === 'nuclei' && (
          <NucleiStudio
            onSendToAI={onSendToAI}
          />
        )}
      </div>
    </div>
  );
}
