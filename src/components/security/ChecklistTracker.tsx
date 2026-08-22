import React, { useState, useEffect } from 'react';
import { Filter, Plus } from 'lucide-react';
import ConfirmModal from '../ConfirmModal';
import type { SecurityChecklistItem } from '../../types';
import {
  CHECKLIST_SUITES,
  SUITE_OPTIONS,
  SAMPLE_JSON_CHECKLIST,
  type ChecklistSuite,
} from '../../data/security/defaultChecklists';
import ChecklistHeader from './checklists/ChecklistHeader';
import ChecklistItemCard from './checklists/ChecklistItemCard';
import ImportJsonModal from './checklists/ImportJsonModal';
import styles from './ChecklistTracker.module.css';

const DEFAULT_CHECKLIST = CHECKLIST_SUITES.core4.items;
const CHECKLIST_STORAGE_KEY = 'nexus_security_checklists';
const CUSTOM_SUITES_STORAGE_KEY = 'nexus_custom_checklist_suites';

interface ChecklistTrackerProps {
  onSendToAI?: (prompt: string) => void;
}

export default function ChecklistTracker({ onSendToAI }: ChecklistTrackerProps) {
  const [items, setItems] = useState<SecurityChecklistItem[]>(() => {
    try {
      const saved = localStorage.getItem(CHECKLIST_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Failed to load checklist from localStorage:', e);
    }
    return DEFAULT_CHECKLIST;
  });

  const [customSuites, setCustomSuites] = useState<Record<string, ChecklistSuite>>(() => {
    try {
      const saved = localStorage.getItem(CUSTOM_SUITES_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed === 'object' && parsed !== null) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Failed to load custom suites from localStorage:', e);
    }
    return {};
  });

  const [filter, setFilter] = useState<'all' | 'untested' | 'pass' | 'fail'>('all');
  const [newTitle, setNewTitle] = useState('');
  const [newCode, setNewCode] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  // JSON Import State
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [jsonInput, setJsonInput] = useState('');
  const [importMode, setImportMode] = useState<'replace' | 'append' | 'new_suite'>('replace');
  const [newSuiteName, setNewSuiteName] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [parsedCount, setParsedCount] = useState<number | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);

  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    variant?: 'danger' | 'primary' | 'warning' | 'info';
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  useEffect(() => {
    try {
      localStorage.setItem(CHECKLIST_STORAGE_KEY, JSON.stringify(items));
    } catch (e) {
      console.error('Failed to save checklist to localStorage:', e);
    }
  }, [items]);

  useEffect(() => {
    try {
      localStorage.setItem(CUSTOM_SUITES_STORAGE_KEY, JSON.stringify(customSuites));
    } catch (e) {
      console.error('Failed to save custom suites to localStorage:', e);
    }
  }, [customSuites]);

  const handleStatusChange = (id: string, newStatus: SecurityChecklistItem['status']) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, status: newStatus } : it)));
  };

  const handleLoadSuite = (suiteKey: string) => {
    const allSuites = { ...CHECKLIST_SUITES, ...customSuites };
    const suite = allSuites[suiteKey];
    if (!suite) return;
    setModalConfig({
      isOpen: true,
      title: 'Load Methodology Suite',
      message: `Load "${suite.label}" checklist? This will update your active items to this testing standard.`,
      confirmLabel: 'Load Suite',
      variant: 'primary',
      onConfirm: () => {
        setItems(suite.items);
        setModalConfig((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  const handleResetChecklist = () => {
    setModalConfig({
      isOpen: true,
      title: 'Reset Checklist Progress',
      message: 'Are you sure you want to reset all checklist items back to Untested status (0% progress)?',
      confirmLabel: 'Reset All',
      variant: 'warning',
      onConfirm: () => {
        setItems((prev) => prev.map((item) => ({ ...item, status: 'untested' })));
        setModalConfig((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    const item: SecurityChecklistItem = {
      id: `custom-${Date.now()}`,
      category: 'Custom Verification',
      code: newCode.trim() || `TEST-${items.length + 1}`,
      title: newTitle.trim(),
      description: 'Custom security test item defined for this engagement.',
      status: 'untested',
    };
    setItems((prev) => [item, ...prev]);
    setNewTitle('');
    setNewCode('');
    setShowAddForm(false);
  };

  const handleDeleteItem = (id: string, code: string) => {
    setModalConfig({
      isOpen: true,
      title: 'Delete Checklist Item',
      message: `Are you sure you want to remove item [${code}] from this engagement?`,
      confirmLabel: 'Delete Item',
      variant: 'danger',
      onConfirm: () => {
        setItems((prev) => prev.filter((it) => it.id !== id));
        setModalConfig((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  // Safe JSON Checklist Parser
  const parseChecklistJson = (raw: string): { valid: boolean; items: SecurityChecklistItem[]; error?: string } => {
    if (!raw.trim()) {
      return { valid: false, items: [], error: 'Please paste or upload JSON checklist data.' };
    }
    try {
      const parsed = JSON.parse(raw);
      const rawArray = Array.isArray(parsed)
        ? parsed
        : Array.isArray((parsed as Record<string, unknown>).items)
        ? ((parsed as Record<string, unknown>).items as unknown[])
        : Array.isArray((parsed as Record<string, unknown>).checklist)
        ? ((parsed as Record<string, unknown>).checklist as unknown[])
        : null;

      if (!rawArray) {
        return {
          valid: false,
          items: [],
          error: 'JSON must be an array of checklist objects, e.g. [ { "code": "...", "title": "..." } ]',
        };
      }

      if (rawArray.length === 0) {
        return { valid: false, items: [], error: 'Checklist array is empty.' };
      }

      const sanitizedItems: SecurityChecklistItem[] = rawArray.map((rawItem: unknown, idx: number) => {
        if (typeof rawItem !== 'object' || rawItem === null) {
          throw new Error(`Item #${idx + 1} is not a valid JSON object.`);
        }
        const it = rawItem as Record<string, unknown>;
        const title = String(it.title || it.name || '').trim();
        if (!title) {
          throw new Error(`Item #${idx + 1} is missing a required "title" property.`);
        }
        const code = String(it.code || it.id || `TEST-${idx + 1}`).trim();
        const category = String(it.category || it.group || 'Custom Verification').trim();
        const description = String(it.description || it.desc || 'Custom checklist security test.').trim();
        const statusRaw = String(it.status || 'untested').toLowerCase();
        const status: SecurityChecklistItem['status'] =
          statusRaw === 'pass' || statusRaw === 'passed'
            ? 'pass'
            : statusRaw === 'fail' || statusRaw === 'failed'
            ? 'fail'
            : 'untested';

        return {
          id:
            typeof it.id === 'string' && it.id.length > 3
              ? it.id
              : `chk-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
          category,
          code,
          title,
          description,
          status,
        };
      });

      return { valid: true, items: sanitizedItems };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invalid JSON syntax.';
      return { valid: false, items: [], error: msg };
    }
  };

  const handleJsonInputChange = (val: string) => {
    setJsonInput(val);
    if (!val.trim()) {
      setImportError(null);
      setParsedCount(null);
      return;
    }
    const res = parseChecklistJson(val);
    if (res.valid) {
      setImportError(null);
      setParsedCount(res.items.length);
    } else {
      setImportError(res.error || 'Invalid JSON format');
      setParsedCount(null);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadedFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setJsonInput(content);
        const res = parseChecklistJson(content);
        if (res.valid) {
          setImportError(null);
          setParsedCount(res.items.length);
        } else {
          setImportError(res.error || 'Failed to parse uploaded JSON file.');
          setParsedCount(null);
        }
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleInsertSampleTemplate = () => {
    setJsonInput(SAMPLE_JSON_CHECKLIST);
    const res = parseChecklistJson(SAMPLE_JSON_CHECKLIST);
    if (res.valid) {
      setImportError(null);
      setParsedCount(res.items.length);
    }
    setUploadedFileName(null);
  };

  const handleExecuteImport = () => {
    const res = parseChecklistJson(jsonInput);
    if (!res.valid) {
      setImportError(res.error || 'Cannot import invalid JSON checklist.');
      return;
    }
    if (importMode === 'replace') {
      setItems(res.items);
    } else if (importMode === 'append') {
      setItems((prev) => [...prev, ...res.items]);
    } else if (importMode === 'new_suite') {
      const suiteTitle =
        newSuiteName.trim() ||
        (uploadedFileName
          ? uploadedFileName.replace(/\.json$/i, '')
          : `Custom Suite ${Object.keys(customSuites).length + 1}`);
      const suiteId = `custom_suite_${Date.now()}`;
      setCustomSuites((prev) => ({
        ...prev,
        [suiteId]: {
          label: suiteTitle,
          items: res.items,
        },
      }));
      setItems(res.items);
    }
    setIsImportOpen(false);
    setJsonInput('');
    setNewSuiteName('');
    setImportError(null);
    setParsedCount(null);
    setUploadedFileName(null);
  };

  const handleExportJson = () => {
    const dataStr = JSON.stringify(items, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nexus_checklist_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleAiGapAnalysis = () => {
    if (!onSendToAI) return;
    const completed = items.filter((i) => i.status === 'pass').map((i) => i.code);
    const failed = items.filter((i) => i.status === 'fail').map((i) => `${i.code}: ${i.title}`);
    const remaining = items.filter((i) => i.status === 'untested').map((i) => `${i.code}: ${i.title}`);

    const prompt = `Review my current VAPT assessment coverage:\n\n- Passed/Verified Controls (${completed.length}): ${completed.join(', ') || 'None'}\n- Failed Controls / Vulnerabilities (${failed.length}):\n${failed.map((f) => `  * ${f}`).join('\n') || 'None'}\n- Remaining Untested (${remaining.length}):\n${remaining.slice(0, 8).map((r) => `  * ${r}`).join('\n')}\n\nProvide recommendations on priority attack vectors to test next, potential chained exploits, and missing test cases.`;
    onSendToAI(prompt);
  };

  const total = items.length;
  const testedCount = items.filter((i) => i.status !== 'untested').length;
  const failCount = items.filter((i) => i.status === 'fail').length;
  const progressPercent = total > 0 ? Math.round((testedCount / total) * 100) : 0;

  const filteredItems = items.filter((i) => {
    if (filter === 'all') return true;
    return i.status === filter;
  });

  const dynamicSuiteOptions = [
    ...SUITE_OPTIONS,
    ...Object.entries(customSuites).map(([key, s]) => ({
      value: key,
      label: `📋 ${s.label} (${s.items.length} Tests)`,
      badge: 'Custom',
    })),
  ];

  return (
    <div className={styles.checklistContainer}>
      {/* Header Toolbar */}
      <ChecklistHeader
        progressPercent={progressPercent}
        testedCount={testedCount}
        total={total}
        failCount={failCount}
        suiteOptions={dynamicSuiteOptions}
        onLoadSuite={handleLoadSuite}
        showAddForm={showAddForm}
        onToggleAddForm={() => setShowAddForm(!showAddForm)}
        onOpenImportModal={() => {
          setJsonInput('');
          setImportError(null);
          setParsedCount(null);
          setUploadedFileName(null);
          setIsImportOpen(true);
        }}
        onExportJson={handleExportJson}
        onResetChecklist={handleResetChecklist}
        onAiGapAnalysis={handleAiGapAnalysis}
      />

      {/* Filter Tabs */}
      <div className={styles.filterBar}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Filter size={13} color="#94a3b8" />
          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Filter Tests:</span>
        </div>
        <div style={{ display: 'flex', gap: '0.3rem' }}>
          <button
            className={`${styles.filterBtn} ${filter === 'all' ? styles.filterBtnActive : ''}`}
            onClick={() => setFilter('all')}
          >
            All ({total})
          </button>
          <button
            className={`${styles.filterBtn} ${filter === 'untested' ? styles.filterBtnActive : ''}`}
            onClick={() => setFilter('untested')}
          >
            Untested ({total - testedCount})
          </button>
          <button
            className={`${styles.filterBtn} ${filter === 'pass' ? styles.filterBtnActive : ''}`}
            onClick={() => setFilter('pass')}
          >
            Passed ({items.filter((i) => i.status === 'pass').length})
          </button>
          <button
            className={`${styles.filterBtn} ${filter === 'fail' ? styles.filterBtnActive : ''}`}
            onClick={() => setFilter('fail')}
          >
            Vulnerabilities ({failCount})
          </button>
        </div>
      </div>

      {/* Add Item Form */}
      {showAddForm && (
        <form className={styles.addForm} onSubmit={handleAddItem}>
          <div style={{ display: 'flex', gap: '0.4rem', flex: 1 }}>
            <input
              type="text"
              placeholder="Code (e.g. AUTH-03)"
              value={newCode}
              onChange={(e) => setNewCode(e.target.value)}
              className={styles.addInput}
              style={{ width: '130px' }}
            />
            <input
              type="text"
              placeholder="Test Title (e.g. JWT Signature None Alg Verification)"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className={styles.addInput}
              style={{ flex: 1 }}
            />
          </div>
          <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`}>
            Add Test
          </button>
        </form>
      )}

      {/* Items List */}
      <div className={styles.itemsList}>
        {filteredItems.map((item) => (
          <ChecklistItemCard
            key={item.id}
            item={item}
            onStatusChange={handleStatusChange}
            onDeleteItem={handleDeleteItem}
          />
        ))}
      </div>

      {/* JSON Import Modal */}
      <ImportJsonModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        jsonInput={jsonInput}
        onChangeJsonInput={handleJsonInputChange}
        importMode={importMode}
        onChangeImportMode={setImportMode}
        newSuiteName={newSuiteName}
        onChangeSuiteName={setNewSuiteName}
        importError={importError}
        parsedCount={parsedCount}
        uploadedFileName={uploadedFileName}
        onFileUpload={handleFileUpload}
        onInsertSample={handleInsertSampleTemplate}
        onExecuteImport={handleExecuteImport}
      />

      {/* Confirmation Modal */}
      {modalConfig.isOpen && (
        <ConfirmModal
          title={modalConfig.title}
          message={modalConfig.message}
          confirmLabel={modalConfig.confirmLabel}
          variant={modalConfig.variant}
          onConfirm={modalConfig.onConfirm}
          onCancel={() => setModalConfig((prev) => ({ ...prev, isOpen: false }))}
        />
      )}
    </div>
  );
}
