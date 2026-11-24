import { useState, useRef, useEffect, useMemo, lazy, Suspense } from 'react';
import { createPortal } from 'react-dom';
import {
  Sparkles,
  X,
  Maximize2,
  Minimize2,
  ChevronDown,
  Check,
  UploadCloud,
  Search,
  ShieldAlert,
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
  const [searchQuery, setSearchQuery] = useState('');
  const [modalCategory, setModalCategory] = useState<TabCategory>('all');
  const searchInputRef = useRef<HTMLInputElement>(null);

  const activeTabInfo = SECURITY_TABS.find((t) => t.id === activeTab);
  const ActiveIcon = activeTabInfo?.icon || SECURITY_TABS[0].icon;

  const activeCategoryLabel = useMemo(() => {
    const cat = CATEGORIES.find((c) => c.id === activeTabInfo?.category);
    return cat ? cat.label.split('&')[0].trim() : 'Tool';
  }, [activeTabInfo]);

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

  useEffect(() => {
    if (dropdownOpen) {
      setSearchQuery('');
      setModalCategory('all');
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [dropdownOpen]);

  const filteredTools = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return SECURITY_TABS.filter((t) => {
      const matchCat = modalCategory === 'all' || t.category === modalCategory;
      if (!matchCat) return false;
      if (!q) return true;
      return (
        t.name.toLowerCase().includes(q) ||
        t.tooltip.toLowerCase().includes(q) ||
        t.keywords.some((k) => k.toLowerCase().includes(q))
      );
    });
  }, [modalCategory, searchQuery]);

  const handleCategoryPillClick = (cat: TabCategory) => {
    setCategory(cat);
    if (cat === 'all') {
      setDropdownOpen(true);
      setModalCategory('all');
      return;
    }
    const firstInCat = SECURITY_TABS.find((t) => t.category === cat);
    if (firstInCat && activeTabInfo?.category !== cat) {
      onTabChange(firstInCat.id);
    }
  };

  const handleSendToSandbox = (code: string) => {
    setSandboxCode(code);
    onTabChange('sandbox');
  };

  const handleAskAIWithActiveContext = () => {
    onSendToAI(getAskAiContext(activeTab));
  };

  return (
    <div ref={canvasRef} className={styles.canvasContainer}>
      {/* Canvas Header & Tools Dropdown Modal */}
      <div className={styles.canvasHeader}>
        {/* Left: Tool Dropdown Trigger & Category Quick Filter */}
        <div className={styles.toolSelectorWrapper} ref={dropdownRef}>
          <button
            type="button"
            className={`${styles.toolDropdownTrigger} ${dropdownOpen ? styles.toolDropdownTriggerOpen : ''}`}
            onClick={() => setDropdownOpen((prev) => !prev)}
            title="Open Security Modules Menu"
            aria-label="Select security tool"
            aria-expanded={dropdownOpen}
            aria-haspopup="dialog"
          >
            <div className={`${styles.toolTriggerIconWrap} ${styles[`tile_${activeTabInfo?.category || 'assess'}`]}`}>
              <ActiveIcon size={14} />
            </div>
            <div className={styles.toolTriggerTextWrap}>
              <span className={styles.toolTriggerName}>{activeTabInfo?.name || 'Tools'}</span>
              <span className={styles.toolTriggerCategory}>{activeCategoryLabel}</span>
            </div>
            <ChevronDown
              size={13}
              className={`${styles.toolTriggerChevron} ${dropdownOpen ? styles.toolTriggerChevronOpen : ''}`}
            />
          </button>

          {/* Category Quick Pills */}
          <div className={styles.categoryPillsGroup}>
            {(['all', 'assess', 'web', 'recon', 'defense'] as const).map((cat) => (
              <button
                key={cat}
                type="button"
                className={`${styles.catPillBtn} ${
                  cat === 'all'
                    ? category === 'all'
                      ? styles.catPillBtnActive
                      : ''
                    : activeTabInfo?.category === cat
                      ? styles.catPillBtnActive
                      : ''
                }`}
                onClick={() => handleCategoryPillClick(cat)}
                title={`Switch to ${cat === 'all' ? 'All tools' : cat} category`}
              >
                {cat === 'all' ? 'All' : cat === 'assess' ? 'Assess' : cat === 'web' ? 'Web' : cat === 'recon' ? 'Recon' : 'Defense'}
              </button>
            ))}
          </div>

          {dropdownOpen &&
            createPortal(
              <div
                className={styles.modalPortalOverlay}
                onClick={() => setDropdownOpen(false)}
                role="presentation"
              >
                <div
                  className={styles.modalPortalDialog}
                  role="dialog"
                  aria-modal="true"
                  aria-label="Security Modules Launcher"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className={styles.modalHeaderRow}>
                    <div className={styles.modalTitleBadge}>
                      <ShieldAlert size={15} color="#10b981" />
                      <span className={styles.modalHeaderTitle}>Security Modules Launcher</span>
                      <span className={styles.modalCountBadge}>{SECURITY_TABS.length} Tools</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className={styles.modalEscBadge}>ESC</span>
                      <button
                        type="button"
                        className={styles.modalCloseBtn}
                        onClick={() => setDropdownOpen(false)}
                        aria-label="Close tools menu"
                      >
                        <X size={15} />
                      </button>
                    </div>
                  </div>

                  {/* Search Bar */}
                  <div className={styles.modalSearchBox}>
                    <Search size={15} className={styles.modalSearchIcon} />
                    <input
                      ref={searchInputRef}
                      type="text"
                      className={styles.modalSearchInput}
                      placeholder="Filter by module, capability, or tool (e.g. nuclei, jwt, burp, owasp, cwe)..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') setDropdownOpen(false);
                        if (e.key === 'Enter' && filteredTools.length > 0) {
                          onTabChange(filteredTools[0].id);
                          setDropdownOpen(false);
                        }
                      }}
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        className={styles.modalSearchClear}
                        onClick={() => setSearchQuery('')}
                        aria-label="Clear search"
                      >
                        <X size={13} />
                      </button>
                    )}
                  </div>

                  {/* Modal Category Filter Chips */}
                  <div className={styles.modalCategoryChips}>
                    {(['all', 'assess', 'web', 'recon', 'defense'] as const).map((cat) => {
                      const count =
                        cat === 'all'
                          ? SECURITY_TABS.length
                          : SECURITY_TABS.filter((t) => t.category === cat).length;
                      return (
                        <button
                          key={cat}
                          type="button"
                          className={`${styles.modalCatChip} ${modalCategory === cat ? styles.modalCatChipActive : ''}`}
                          onClick={() => setModalCategory(cat)}
                        >
                          {cat === 'all' ? 'All' : cat === 'assess' ? 'Assess' : cat === 'web' ? 'Web' : cat === 'recon' ? 'Recon' : 'Defense'}
                          <span className={styles.modalCatCount}>{count}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Tool List */}
                  <div className={styles.modalToolList}>
                    {filteredTools.length === 0 ? (
                      <div className={styles.modalNoResults}>
                        No security tools matched "{searchQuery}". Try searching for another keyword.
                      </div>
                    ) : (
                      CATEGORIES.map((cat) => {
                        const toolsInCat = filteredTools.filter((t) => t.category === cat.id);
                        if (toolsInCat.length === 0) return null;
                        return (
                          <div key={cat.id} className={styles.modalGroup}>
                            <div className={styles.modalGroupHeader}>
                              <span>{cat.label}</span>
                              <span className={styles.groupCount}>{toolsInCat.length} modules</span>
                            </div>
                            <div className={styles.modalGroupGrid}>
                              {toolsInCat.map((t) => {
                                const Icon = t.icon;
                                const isActive = activeTab === t.id;
                                return (
                                  <button
                                    key={t.id}
                                    type="button"
                                    className={`${styles.modalToolItem} ${isActive ? styles.modalToolItemActive : ''}`}
                                    onClick={() => {
                                      onTabChange(t.id);
                                      setDropdownOpen(false);
                                    }}
                                    title={t.tooltip}
                                  >
                                    <div className={`${styles.modalToolIconTile} ${styles[`tile_${t.category}`]}`}>
                                      <Icon size={16} />
                                    </div>
                                    <div className={styles.modalToolInfo}>
                                      <div className={styles.modalToolTitleRow}>
                                        <span className={styles.modalToolName}>{t.name}</span>
                                        {isActive && (
                                          <span className={styles.activePillBadge}>
                                            <Check size={10} /> Active
                                          </span>
                                        )}
                                      </div>
                                      <span className={styles.modalToolDesc}>{t.tooltip}</span>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Modal Footer with Shortcuts */}
                  <div className={styles.modalFooterRow}>
                    <div className={styles.footerHints}>
                      <span><span className={styles.kbdBadge}>↑↓</span> Navigate</span>
                      <span><span className={styles.kbdBadge}>↵</span> Select</span>
                      <span><span className={styles.kbdBadge}>ESC</span> Close</span>
                    </div>
                    <div className={styles.footerCurrent}>
                      Current Module: <strong>{activeTabInfo?.name || 'Dashboard'}</strong>
                    </div>
                  </div>
                </div>
              </div>,
              document.body
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
