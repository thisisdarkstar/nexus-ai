import { useState, useMemo, useEffect } from 'react';
import { Sparkles, ArrowRight } from 'lucide-react';
import {
  type PayloadCategory,
  type EncodingType,
  type PayloadParams,
  getPayloadsForCategory,
  encodePayloadString,
  PAYLOAD_CATEGORIES,
} from '../../data/security/payloadCatalog';
import PayloadCategorySelector from './payloads/PayloadCategorySelector';
import PayloadParamsBar from './payloads/PayloadParamsBar';
import PayloadEncoderBar from './payloads/PayloadEncoderBar';
import PayloadCard from './payloads/PayloadCard';
import styles from './PayloadCrafter.module.css';

interface PayloadCrafterProps {
  onSendToAI: (prompt: string) => void;
  onSendToSandbox?: (code: string) => void;
}

const LHOST_STORAGE_KEY = 'nexus_security_lhost';
const LPORT_STORAGE_KEY = 'nexus_security_lport';
const TARGET_HOST_STORAGE_KEY = 'nexus_security_target_host';
const TARGET_FILE_STORAGE_KEY = 'nexus_security_target_file';

export default function PayloadCrafter({ onSendToAI, onSendToSandbox }: PayloadCrafterProps) {
  const [lhost, setLhost] = useState(() => {
    try { return localStorage.getItem(LHOST_STORAGE_KEY) || '10.10.14.x'; } catch { return '10.10.14.x'; }
  });
  const [lport, setLport] = useState(() => {
    try { return localStorage.getItem(LPORT_STORAGE_KEY) || '4444'; } catch { return '4444'; }
  });
  const [targetHost, setTargetHost] = useState(() => {
    try { return localStorage.getItem(TARGET_HOST_STORAGE_KEY) || 'target.com'; } catch { return 'target.com'; }
  });
  const [targetFile, setTargetFile] = useState(() => {
    try { return localStorage.getItem(TARGET_FILE_STORAGE_KEY) || '/etc/passwd'; } catch { return '/etc/passwd'; }
  });

  const [activeCategory, setActiveCategory] = useState<PayloadCategory>(() => {
    try { return (localStorage.getItem('nexus_security_payload_category') as PayloadCategory) || 'shells'; } catch { return 'shells'; }
  });
  const [encoding, setEncoding] = useState<EncodingType>(() => {
    try { return (localStorage.getItem('nexus_security_payload_encoding') as EncodingType) || 'raw'; } catch { return 'raw'; }
  });
  const [filterQuery, setFilterQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(LHOST_STORAGE_KEY, lhost);
      localStorage.setItem(LPORT_STORAGE_KEY, lport);
      localStorage.setItem(TARGET_HOST_STORAGE_KEY, targetHost);
      localStorage.setItem(TARGET_FILE_STORAGE_KEY, targetFile);
      localStorage.setItem('nexus_security_payload_category', activeCategory);
      localStorage.setItem('nexus_security_payload_encoding', encoding);
    } catch (e) {
      console.error(e);
    }
  }, [lhost, lport, targetHost, targetFile, activeCategory, encoding]);

  const params: PayloadParams = useMemo(
    () => ({ lhost, lport, targetHost, targetFile }),
    [lhost, lport, targetHost, targetFile]
  );

  const handleChangeParam = (key: keyof PayloadParams, value: string) => {
    if (key === 'lhost') setLhost(value);
    if (key === 'lport') setLport(value);
    if (key === 'targetHost') setTargetHost(value);
    if (key === 'targetFile') setTargetFile(value);
  };

  const currentPayloads = useMemo(() => {
    return getPayloadsForCategory(activeCategory, params);
  }, [activeCategory, params]);

  const filteredPayloads = useMemo(() => {
    if (!filterQuery.trim()) return currentPayloads;
    const q = filterQuery.toLowerCase();
    return currentPayloads.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.tags.toLowerCase().includes(q) ||
        p.payload.toLowerCase().includes(q)
    );
  }, [currentPayloads, filterQuery]);

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleAICustomCrafter = () => {
    const currentCatInfo = PAYLOAD_CATEGORIES.find((c) => c.id === activeCategory);
    const prompt = `I am crafting custom exploits for category: **${currentCatInfo?.name}**.
Current parameters:
- LHOST: \`${lhost}\`
- LPORT: \`${lport}\`
- Target Host: \`${targetHost}\`
- Target File: \`${targetFile}\`

Generate 3 advanced, real-world bypass payloads for this category with detailed explanations of the bypass mechanism and defense remediation.`;
    onSendToAI(prompt);
  };

  return (
    <div className={styles.crafterContainer}>
      {/* Category Navigation Bar */}
      <PayloadCategorySelector
        activeCategory={activeCategory}
        onSelectCategory={setActiveCategory}
      />

      {/* Target & Attacker Configuration */}
      <PayloadParamsBar
        params={params}
        onChangeParams={handleChangeParam}
        activeCategory={activeCategory}
      />

      {/* Real-time Encoding & Filter Bar */}
      <PayloadEncoderBar
        encoding={encoding}
        onSelectEncoding={setEncoding}
        filterQuery={filterQuery}
        onChangeFilter={setFilterQuery}
      />

      {/* Payload Cards Grid */}
      <div className={styles.payloadGrid}>
        {filteredPayloads.length > 0 ? (
          filteredPayloads.map((item) => {
            const encoded = encodePayloadString(item.payload, encoding, item.type);
            return (
              <PayloadCard
                key={item.id}
                item={item}
                encodedPayload={encoded}
                isCopied={copiedId === item.id}
                onCopy={handleCopy}
                onSendToAI={onSendToAI}
                onSendToSandbox={onSendToSandbox}
              />
            );
          })
        ) : (
          <div className={styles.emptyState}>
            <span>No payloads match &quot;{filterQuery}&quot;</span>
          </div>
        )}
      </div>

      {/* Footer AI Assist Banner */}
      <div className={styles.aiFooterBanner}>
        <div className={styles.aiBannerInfo}>
          <Sparkles size={16} className={styles.aiBannerIcon} />
          <span>Need custom WAF bypasses, polyglots, or obfuscated payloads?</span>
        </div>
        <button className={styles.aiBannerBtn} onClick={handleAICustomCrafter}>
          <span>Ask AI Payload Architect</span>
          <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}
