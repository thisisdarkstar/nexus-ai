import { useState, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { VulnerabilityFinding, VulnerabilitySeverity } from '../../types';
import {
  SAMPLE_VULNERABILITIES,
  detectHeuristicVulnerabilities,
} from '../../data/security/auditCodeSamples';
import CodeEditorPanel from './code-auditor/CodeEditorPanel';
import AuditFindingCard from './code-auditor/AuditFindingCard';
import AddFindingForm from './code-auditor/AddFindingForm';
import styles from './CodeAuditor.module.css';

interface CodeAuditorProps {
  initialCode?: string;
  /** Bumped per dispatch so identical code re-applies instead of being skipped */
  initialCodeNonce?: number;
  onSendToAI?: (prompt: string) => void;
}

const CODE_AUDITOR_CODE_STORAGE_KEY = 'nexus_security_code_auditor_code';
const CODE_AUDITOR_LANG_STORAGE_KEY = 'nexus_security_code_auditor_lang';
const CODE_AUDITOR_FINDINGS_STORAGE_KEY = 'nexus_security_code_auditor_findings';

function parseAIFindings(aiContent: string, sourceCode: string): VulnerabilityFinding[] {
  const heuristic = detectHeuristicVulnerabilities(sourceCode);
  if (!aiContent) return heuristic;

  // 1. Extract Title
  let title = '';
  const titleMatch = aiContent.match(/\*\*Vulnerability Title:\*\*\s*([^\n]+)/i);
  if (titleMatch) {
    title = titleMatch[1].replace(/[*#_`]/g, '').trim();
  } else {
    const genericTitleMatch = aiContent.match(
      /(?:#+\s*1?\s*\.?\s*|Title:\s*)([^\n]+(?:Injection|Vulnerability|XSS|SSRF|Bypass|Flaw|Overflow|Exposure|Deserialization|Sanitization|Traversal|Arbitrary|Execution|Control)[^\n]*)/i
    );
    if (genericTitleMatch) {
      title = genericTitleMatch[1].replace(/[*#_`]/g, '').trim();
    } else {
      title = heuristic[0]?.title || 'Identified Security Flaw';
    }
  }

  // 2. Extract Severity
  let severity: VulnerabilitySeverity = 'high';
  const severityMatch = aiContent.match(/\*\*Severity:\*\*\s*\*{0,2}(Critical|High|Medium|Low|Info)\*{0,2}/i);
  if (severityMatch) {
    severity = severityMatch[1].toLowerCase() as VulnerabilitySeverity;
  } else if (/critical/i.test(aiContent)) {
    severity = 'critical';
  } else if (/high/i.test(aiContent)) {
    severity = 'high';
  } else if (/medium/i.test(aiContent)) {
    severity = 'medium';
  } else if (/low/i.test(aiContent)) {
    severity = 'low';
  } else if (/info/i.test(aiContent)) {
    severity = 'info';
  }

  // 3. Extract CWE ID
  let cweId = 'CWE-89';
  const cweExplicitMatch = aiContent.match(/\*\*CWE ID:\*\*\s*\*{0,2}(CWE-\d+)\*{0,2}/i);
  if (cweExplicitMatch) {
    cweId = cweExplicitMatch[1].toUpperCase();
  } else {
    const cweMatch = aiContent.match(/CWE-\d+/i);
    cweId = cweMatch ? cweMatch[0].toUpperCase() : heuristic[0]?.cweId || 'CWE-Other';
  }

  // 4. Extract OWASP Top 10 Category
  let owaspCategory = 'A03:2021-Injection';
  const owaspMatch = aiContent.match(/\*\*OWASP Top 10 Category:\*\*\s*([^\n]+)/i);
  if (owaspMatch) {
    owaspCategory = owaspMatch[1].replace(/[*_`]/g, '').trim();
  } else if (heuristic[0]?.owaspCategory) {
    owaspCategory = heuristic[0].owaspCategory;
  }

  // 5. Extract Impact & Description
  let description = '';
  const impactMatch = aiContent.match(/\*\*Impact:\*\*\s*([^\n]+(?:\n[^\n#*]+)*)/i);
  if (impactMatch) {
    description = impactMatch[1].replace(/[*_`]/g, '').trim();
  } else {
    const descMatch = aiContent.match(/(?:Impact|Scenario|Description):\s*([^\n]+(?:\n[^\n#]+)?)/i);
    description = descMatch
      ? descMatch[1].replace(/[*_`]/g, '').trim()
      : heuristic[0]?.description || 'Static analysis detected security risks in user input handling and active execution sinks.';
  }

  // 6. Extract Remediation
  let remediation = '';
  const remSectionMatch = aiContent.match(/(?:###\s*4\.\s*Recommended Secure Remediation[^\n]*\n+)([\s\S]*?)(?=####\s*Before|```|$)/i);
  if (remSectionMatch && remSectionMatch[1].trim()) {
    remediation = remSectionMatch[1].replace(/[*_`]/g, '').trim();
  } else {
    const remMatch = aiContent.match(/(?:Remediation|Recommendation|Fix|Remediated):\s*([^\n]+(?:\n[^\n#]+)?)/i);
    remediation = remMatch
      ? remMatch[1].replace(/[*_`]/g, '').trim()
      : heuristic[0]?.remediation || 'Apply secure input validation and safe coding practices.';
  }

  // 7. Extract Before / After Diff blocks
  let originalDiff = '';
  let patchedDiff = '';

  const beforeMatch = aiContent.match(/(?:#+\s*Before[^\n]*\n+```[a-zA-Z0-9_-]*\n)([\s\S]*?)(?=```)/i);
  if (beforeMatch) {
    originalDiff = beforeMatch[1].trim();
  }

  const afterMatch = aiContent.match(/(?:#+\s*After[^\n]*\n+```[a-zA-Z0-9_-]*\n)([\s\S]*?)(?=```)/i);
  if (afterMatch) {
    patchedDiff = afterMatch[1].trim();
  }

  if (!originalDiff || !patchedDiff) {
    const codeBlocks = Array.from(aiContent.matchAll(/```(?:[a-zA-Z0-9_-]+)?\n([\s\S]*?)```/g))
      .map((m) => m[1].trim())
      .filter((b) => b.split('\n').length > 1 || b.includes('def ') || b.includes('function') || b.includes('='));
    if (codeBlocks.length >= 2) {
      originalDiff = originalDiff || codeBlocks[codeBlocks.length - 2];
      patchedDiff = patchedDiff || codeBlocks[codeBlocks.length - 1];
    } else if (codeBlocks.length === 1) {
      originalDiff = originalDiff || (heuristic[0]?.patchDiff?.original || sourceCode.trim());
      patchedDiff = patchedDiff || codeBlocks[0];
    }
  }

  let patchDiff = undefined;
  if (originalDiff || patchedDiff) {
    patchDiff = {
      original: originalDiff,
      patched: patchedDiff,
    };
  }

  return [
    {
      id: `sast-finding-${Date.now()}`,
      title,
      severity,
      cweId,
      owaspCategory,
      description,
      remediation,
      patchDiff,
    },
  ];
}

export default function CodeAuditor({
  initialCode,
  initialCodeNonce,
  onSendToAI,
}: CodeAuditorProps) {
  const [code, setCode] = useState<string>(() => {
    if (initialCode) return initialCode;
    try {
      const saved = localStorage.getItem(CODE_AUDITOR_CODE_STORAGE_KEY);
      if (saved !== null) return saved;
    } catch (e) {
      console.error('Failed to load code from localStorage:', e);
    }
    return SAMPLE_VULNERABILITIES[0].code;
  });

  const [language, setLanguage] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(CODE_AUDITOR_LANG_STORAGE_KEY);
      if (saved) return saved;
    } catch {
      // fallback
    }
    return 'python';
  });

  const [isAuditing, setIsAuditing] = useState(false);
  const [findings, setFindings] = useState<VulnerabilityFinding[]>(() => {
    if (initialCode) {
      return detectHeuristicVulnerabilities(initialCode);
    }
    try {
      const saved = localStorage.getItem(CODE_AUDITOR_FINDINGS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Failed to load findings from localStorage:', e);
    }
    return [SAMPLE_VULNERABILITIES[0].finding];
  });

  // Sync when parent passes new initialCode (e.g. "Audit" from chat code block)
  useEffect(() => {
    if (initialCode) {
      setCode(initialCode);
      setFindings(detectHeuristicVulnerabilities(initialCode));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCode]);

  const [copiedPatchId, setCopiedPatchId] = useState<string | null>(null);
  const [appliedPatchId, setAppliedPatchId] = useState<string | null>(null);
  const [isAddingFinding, setIsAddingFinding] = useState(false);
  const [editorSize, setEditorSize] = useState<'normal' | 'expanded' | 'full'>('normal');
  const [newFinding, setNewFinding] = useState<Partial<VulnerabilityFinding>>({
    title: '',
    severity: 'high',
    cweId: 'CWE-89',
    description: '',
    remediation: '',
  });

  useEffect(() => {
    try {
      localStorage.setItem(CODE_AUDITOR_CODE_STORAGE_KEY, code);
    } catch (e) {
      console.error('Failed to save code to localStorage:', e);
    }
  }, [code]);

  useEffect(() => {
    try {
      localStorage.setItem(CODE_AUDITOR_LANG_STORAGE_KEY, language);
    } catch (e) {
      console.error('Failed to save language to localStorage:', e);
    }
  }, [language]);

  useEffect(() => {
    try {
      localStorage.setItem(CODE_AUDITOR_FINDINGS_STORAGE_KEY, JSON.stringify(findings));
    } catch (e) {
      console.error('Failed to save findings to localStorage:', e);
    }
  }, [findings]);

  const handleSaveCustomFinding = () => {
    if (!newFinding.title?.trim()) return;
    const finding: VulnerabilityFinding = {
      id: `manual-finding-${Date.now()}`,
      title: newFinding.title.trim(),
      severity: newFinding.severity || 'high',
      cweId: newFinding.cweId?.trim() || 'CWE-Other',
      description: newFinding.description?.trim() || 'Identified during manual code review inspection.',
      remediation: newFinding.remediation?.trim() || 'Implement secure validation and safe coding practices.',
      patchDiff: newFinding.patchDiff,
    };
    setFindings((prev) => [finding, ...prev]);
    setIsAddingFinding(false);
    setNewFinding({
      title: '',
      severity: 'high',
      cweId: 'CWE-89',
      description: '',
      remediation: '',
    });
  };

  const handleDeleteFinding = (id: string) => {
    setFindings((prev) => prev.filter((f) => f.id !== id));
  };

  useEffect(() => {
    if (initialCode) {
      setCode(initialCode);
      setFindings(detectHeuristicVulnerabilities(initialCode));
    }
    // initialCodeNonce forces re-apply even when initialCode is unchanged
  }, [initialCode, initialCodeNonce]);

  useEffect(() => {
    const handleSecurityEvent = (e: Event) => {
      const custom = e as CustomEvent<{ tab?: string; code?: string; language?: string }>;
      if (custom.detail?.tab === 'auditor' && custom.detail?.code) {
        const incomingCode = custom.detail.code;
        setCode(incomingCode);
        if (custom.detail.language) {
          const lang = custom.detail.language;
          if (['python', 'javascript', 'typescript', 'go', 'java', 'c', 'cpp', 'php', 'solidity'].includes(lang)) {
            setLanguage(lang === 'cpp' ? 'c' : lang);
          }
        }
        setFindings(detectHeuristicVulnerabilities(incomingCode));
      }
    };
    window.addEventListener('nexus:open-security', handleSecurityEvent);
    return () => window.removeEventListener('nexus:open-security', handleSecurityEvent);
  }, []);

  useEffect(() => {
    const handleAIComplete = (e: Event) => {
      const custom = e as CustomEvent<{ content?: string; prompt?: string }>;
      if (custom.detail?.content && custom.detail?.prompt?.includes('Static Application Security Testing (SAST)')) {
        const parsed = parseAIFindings(custom.detail.content, code);
        if (parsed.length > 0) {
          setFindings(parsed);
        }
        setIsAuditing(false);
      }
    };

    const handleImportSast = (e: Event) => {
      const custom = e as CustomEvent<{ content?: string; text?: string }>;
      const rawText = custom.detail?.content || custom.detail?.text;
      if (rawText) {
        const parsed = parseAIFindings(rawText, code);
        if (parsed.length > 0) {
          setFindings(parsed);
          // If editor has default sample code or is blank, load the vulnerable original code into editor
          if (parsed[0].patchDiff?.original && (!code.trim() || code === SAMPLE_VULNERABILITIES[0].code)) {
            setCode(parsed[0].patchDiff.original);
          }
        }
      }
    };

    window.addEventListener('nexus:ai-response-complete', handleAIComplete);
    window.addEventListener('nexus:import-sast-finding', handleImportSast);
    return () => {
      window.removeEventListener('nexus:ai-response-complete', handleAIComplete);
      window.removeEventListener('nexus:import-sast-finding', handleImportSast);
    };
  }, [code]);

  const handleSelectSample = (sampleId: string) => {
    const sample = SAMPLE_VULNERABILITIES.find((s) => s.id === sampleId);
    if (sample) {
      setCode(sample.code);
      setLanguage(sample.language);
      setFindings([sample.finding]);
    }
  };

  const handleAuditRequest = () => {
    if (!onSendToAI || !code.trim()) return;
    setIsAuditing(true);
    // If heuristic detects findings, populate immediately
    const local = detectHeuristicVulnerabilities(code);
    if (local.length > 0) {
      setFindings(local);
    }
    const prompt = `Perform a rigorous Static Application Security Testing (SAST) audit on the following ${language} code:\n\n\`\`\`${language}\n${code}\n\`\`\`\n\nPlease structure your response with:\n1. Vulnerability Title & Severity (Critical/High/Medium/Low)\n2. CWE ID & OWASP Top 10 Category\n3. Impact & Exploit Scenario\n4. Recommended Secure Remediation (Drop-in Before/After Diff)`;
    onSendToAI(prompt);
  };

  const copyPatch = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPatchId(id);
    setTimeout(() => setCopiedPatchId(null), 2000);
  };

  const applyPatch = (finding: VulnerabilityFinding) => {
    if (!finding.patchDiff || !finding.patchDiff.patched) return;
    const orig = finding.patchDiff.original || '';
    const patched = finding.patchDiff.patched;

    setCode((currentCode) => {
      // 1. Normalize line endings
      const normCurrent = currentCode.replace(/\r\n/g, '\n');
      const normOrig = orig.replace(/\r\n/g, '\n');
      const normPatched = patched.replace(/\r\n/g, '\n');

      // 2. Exact match check
      if (normOrig && normCurrent.includes(normOrig)) {
        return normCurrent.replace(normOrig, normPatched);
      }

      // 3. Trimmed match check
      if (normOrig.trim() && normCurrent.includes(normOrig.trim())) {
        return normCurrent.replace(normOrig.trim(), normPatched.trim());
      }

      // 4. If current editor is empty or matches sample code, replace whole editor
      if (!normCurrent.trim() || normCurrent.trim() === normOrig.trim()) {
        return normPatched;
      }

      // 5. Line-by-line whitespace-insensitive block match
      if (normOrig.trim()) {
        const origLines = normOrig.trim().split('\n').map((l) => l.trim()).filter(Boolean);
        const codeLines = normCurrent.split('\n');

        let matchStart = -1;
        let matchEnd = -1;

        for (let i = 0; i <= codeLines.length - origLines.length; i++) {
          let allMatch = true;
          let k = 0;
          let j = i;
          while (k < origLines.length && j < codeLines.length) {
            const trimmedCodeLine = codeLines[j].trim();
            if (!trimmedCodeLine) {
              j++;
              continue;
            }
            if (trimmedCodeLine !== origLines[k]) {
              allMatch = false;
              break;
            }
            k++;
            j++;
          }
          if (allMatch && k === origLines.length) {
            matchStart = i;
            matchEnd = j;
            break;
          }
        }

        if (matchStart !== -1) {
          const baseIndent = codeLines[matchStart].match(/^\s*/)?.[0] || '';
          const indentedPatched = normPatched
            .split('\n')
            .map((line, idx) => (idx === 0 || !line.trim() ? line : (line.startsWith(baseIndent) ? line : `${baseIndent}${line}`)))
            .join('\n');

          const newLines = [
            ...codeLines.slice(0, matchStart),
            indentedPatched,
            ...codeLines.slice(matchEnd),
          ];
          return newLines.join('\n');
        }
      }

      // 6. Fallback: Append patched code with demarcation
      return `${normCurrent}\n\n# Patched Implementation:\n${normPatched}`;
    });

    setAppliedPatchId(finding.id);
    setTimeout(() => setAppliedPatchId(null), 2500);
  };

  return (
    <div className={styles.auditorContainer}>
      {/* Target Code Editor Panel */}
      <CodeEditorPanel
        code={code}
        onChangeCode={setCode}
        language={language}
        onChangeLanguage={setLanguage}
        onSelectSample={handleSelectSample}
        onScanHeuristics={() => {
          const detected = detectHeuristicVulnerabilities(code);
          if (detected.length > 0) {
            setFindings(detected);
          }
        }}
        onClearCode={() => {
          setCode('');
          setFindings([]);
        }}
        onAuditWithAI={handleAuditRequest}
        isAuditing={isAuditing}
        editorSize={editorSize}
        onToggleEditorSize={() => {
          setEditorSize((prev) => (prev === 'normal' ? 'expanded' : prev === 'expanded' ? 'full' : 'normal'));
        }}
      />

      {/* Vulnerability Findings & Diffs */}
      <div className={styles.findingsList}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.4rem' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            Detected Vulnerabilities &amp; Remediation Diffs ({findings.length})
          </span>
          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
            {findings.length > 0 && (
              <button
                className={styles.btn}
                onClick={() => setFindings([])}
                title="Clear all detected vulnerability findings"
                style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }}
              >
                <Trash2 size={11} /> Clear Findings
              </button>
            )}
            <button
              className={styles.btn}
              onClick={() => setIsAddingFinding(!isAddingFinding)}
              title="Add manual code review finding"
            >
              <Plus size={12} /> {isAddingFinding ? 'Cancel' : 'Add Finding'}
            </button>
          </div>
        </div>

        {isAddingFinding && (
          <AddFindingForm
            newFinding={newFinding}
            onChangeFinding={(updates) => setNewFinding((prev) => ({ ...prev, ...updates }))}
            onSave={handleSaveCustomFinding}
            onCancel={() => setIsAddingFinding(false)}
          />
        )}

        {findings.map((f) => (
          <AuditFindingCard
            key={f.id}
            finding={f}
            onDeleteFinding={handleDeleteFinding}
            onApplyPatch={applyPatch}
            isApplied={appliedPatchId === f.id}
            copiedId={copiedPatchId}
            onCopyPatch={copyPatch}
          />
        ))}
      </div>
    </div>
  );
}
