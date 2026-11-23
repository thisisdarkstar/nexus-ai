import { useState, useRef, useEffect, useCallback, lazy, Suspense } from 'react';
import {
  Sparkles,
  X,
  Maximize2,
  Minimize2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Check,
  UploadCloud,
} from 'lucide-react';

const CodeAuditor = lazy(() => import('./CodeAuditor'));
const SandboxTerminal = lazy(() => import('./SandboxTerminal'));
const DecoderHub = lazy(() => import('./DecoderHub'));
const DetectionStudio = lazy(() => import('./DetectionStudio'));
const ReportStudio = lazy(() => import('./ReportStudio'));
const ScopeManager = lazy(() => import('./ScopeManager'));
const ChecklistTracker = lazy(() => import('./ChecklistTracker'));
const HttpStudio = lazy(() => import('./HttpStudio'));
const PayloadCrafter = lazy(() => import('./PayloadCrafter'));
const ReconHub = lazy(() => import('./ReconHub'));
const AssetGraphViewer = lazy(() => import('./AssetGraphViewer'));
const NucleiStudio = lazy(() => import('./NucleiStudio'));
const RemediationHub = lazy(() => import('./RemediationHub'));
const ApiStudio = lazy(() => import('./ApiStudio'));
const WorkflowStudio = lazy(() => import('./WorkflowStudio'));
const SecurityDashboard = lazy(() => import('./SecurityDashboard'));
const KnowledgeBase = lazy(() => import('./KnowledgeBase'));
import type { SecurityTab } from '../../types';
import { eventBus } from '../../core/bus/EventBus';
import { SECURITY_TABS, type TabCategory } from '../../lib/security/tabRegistry';
import { getAskAiContext } from '../../lib/security/aiContextRegistry';
import styles from './SecurityCanvas.module.css';

interface SecurityCanvasProps {
  activeTab: SecurityTab;
  onTabChange: (tab: SecurityTab) => void;
  onClose?: () => void;
  onSendToAI?: (prompt: string) => void;
  initialCode?: string;
  initialDecoderInput?: string;
}

const CATEGORIES: Array<{ id: Exclude<TabCategory, 'all'>; label: string }> = [
  { id: 'assess', label: 'Assessment & Scope' },
  { id: 'web', label: 'Web & Exploits' },
  { id: 'recon', label: 'Recon & Automation' },
  { id: 'defense', label: 'Code & Defense' },
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
  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onFullscreenChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await canvasRef.current?.requestFullscreen();
      }
    } catch (err) {
      console.error('Fullscreen request failed:', err);
    }
  };

  const [category, setCategory] = useState<TabCategory>('all');
  const [sandboxCode, setSandboxCode] = useState<string | undefined>(undefined);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const tabListRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScrollability = useCallback(() => {
    const el = tabListRef.current;
    if (!el) return;
    const hasOverflow = el.scrollWidth > el.clientWidth + 2;
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(hasOverflow && el.scrollLeft < el.scrollWidth - el.clientWidth - 2);
  }, []);

  const handleTabWheel = (e: React.WheelEvent) => {
    if (tabListRef.current) {
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (delta !== 0) {
        tabListRef.current.scrollLeft += delta;
        checkScrollability();
      }
    }
  };

  const scrollTabs = (direction: 'left' | 'right') => {
    if (!tabListRef.current) return;
    const amount = direction === 'left' ? -260 : 260;
    tabListRef.current.scrollBy({ left: amount, behavior: 'smooth' });
    setTimeout(checkScrollability, 350);
  };

  useEffect(() => {
    checkScrollability();

    const el = tabListRef.current;
    const canvasEl = canvasRef.current;
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => {
        checkScrollability();
      });
      if (el) ro.observe(el);
      if (canvasEl) ro.observe(canvasEl);
    }

    const handleResize = () => checkScrollability();
    window.addEventListener('resize', handleResize);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', handleResize);
    };
  }, [checkScrollability]);

  useEffect(() => {
    if (tabListRef.current) {
      const activeEl = tabListRef.current.querySelector<HTMLElement>(`.${styles.active}`);
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
      }
    }
    const timer = setTimeout(checkScrollability, 60);
    return () => clearTimeout(timer);
  }, [activeTab, category, checkScrollability]);

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
  const ActiveIcon = activeTabInfo?.icon || SECURITY_TABS[0].icon;

  const handleAskAIWithActiveContext = () => {
    onSendToAI(getAskAiContext(activeTab));
  };

  const filteredTabs = SECURITY_TABS.filter(
    (t) => category === 'all' || t.category === category
  );

  return (
    <div ref={canvasRef} className={styles.canvasContainer}>
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
            aria-label="Select security tool"
            aria-expanded={dropdownOpen}
            aria-haspopup="menu"
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
            <div className={styles.dropdownMenu} role="menu" aria-label="Security tools">
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

        {/* Tab Switcher List with Wheel & Arrow Scrolling */}
        <div className={styles.tabNavWrapper}>
          {canScrollLeft && (
            <button
              type="button"
              className={`${styles.scrollArrowBtn} ${styles.scrollArrowLeft}`}
              onClick={() => scrollTabs('left')}
              title="Scroll tabs left"
              aria-label="Scroll tabs left"
            >
              <ChevronLeft size={13} />
            </button>
          )}

          <div
            className={styles.tabList}
            ref={tabListRef}
            onWheel={handleTabWheel}
            onScroll={checkScrollability}
            role="tablist"
            aria-label="Security workbench tools"
          >
            {filteredTabs.map((t) => {
              const Icon = t.icon;
              const isActive = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  className={`${styles.tabBtn} ${isActive ? styles.active : ''}`}
                  onClick={() => onTabChange(t.id)}
                  title={t.tooltip}
                  role="tab"
                  aria-selected={isActive}
                  aria-label={t.name}
                >
                  <Icon size={14} />
                  <span>{t.name}</span>
                </button>
              );
            })}
          </div>

          {canScrollRight && (
            <button
              type="button"
              className={`${styles.scrollArrowBtn} ${styles.scrollArrowRight}`}
              onClick={() => scrollTabs('right')}
              title="Scroll tabs right"
              aria-label="Scroll tabs right"
            >
              <ChevronRight size={13} />
            </button>
          )}
        </div>

        {/* Action Controls */}
        <div className={styles.controlsGroup}>
          <button
            className={styles.iconBtn}
            onClick={() => eventBus.publish('open-ingest', undefined)}
            title="Ingest Scan Artifact (Burp, Nmap, Nuclei, SARIF)"
            aria-label="Ingest scan artifact"
          >
            <UploadCloud size={14} color="#38bdf8" />
          </button>

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
            onClick={() => void toggleFullscreen()}
            title={isFullscreen ? 'Exit Fullscreen' : 'Maximize Canvas'}
            aria-label={isFullscreen ? 'Exit fullscreen' : 'Maximize canvas'}
          >
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>

          {onClose && (
            <button
              className={styles.iconBtn}
              onClick={onClose}
              title="Close Security Workbench"
              aria-label="Close security workbench"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Tab Panels */}
      <div className={styles.tabContent}>
        <Suspense
          fallback={
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                color: 'var(--text-muted, #94a3b8)',
                fontSize: '0.85rem',
                gap: '0.5rem',
              }}
            >
              <div
                style={{
                  width: '18px',
                  height: '18px',
                  border: '2px solid rgba(16, 185, 129, 0.2)',
                  borderTopColor: '#10b981',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite',
                }}
              />
              Loading Security Module...
            </div>
          }
        >
          {activeTab === 'dashboard' && (
            <SecurityDashboard
              onTabChange={onTabChange}
              onSendToAI={onSendToAI}
            />
          )}

          {activeTab === 'auditor' && (
            <CodeAuditor
              initialCode={initialCode}
              onSendToAI={onSendToAI}
            />
          )}

          {activeTab === 'remediation' && (
            <RemediationHub
              onSendToAI={onSendToAI}
            />
          )}

          {activeTab === 'knowledge_base' && (
            <KnowledgeBase
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

          {activeTab === 'api_studio' && (
            <ApiStudio
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

          {activeTab === 'graph' && (
            <AssetGraphViewer
              onSendToAI={onSendToAI}
              onTabChange={onTabChange}
            />
          )}

          {activeTab === 'workflow' && (
            <WorkflowStudio
              onSendToAI={onSendToAI}
            />
          )}

          {activeTab === 'nuclei' && (
            <NucleiStudio
              onSendToAI={onSendToAI}
            />
          )}
        </Suspense>
      </div>
    </div>
  );
}
