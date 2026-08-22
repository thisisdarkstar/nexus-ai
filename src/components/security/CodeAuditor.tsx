import { useState, useEffect } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  RotateCcw,
  Check,
  Copy,
  GitPullRequest,
  FileCode,
  FileText,
  Loader2,
  Plus,
  Trash2,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import CustomSelect from '../CustomSelect';
import type { VulnerabilityFinding, VulnerabilitySeverity } from '../../types';
import styles from './CodeAuditor.module.css';

const LANGUAGE_OPTIONS = [
  { value: 'python', label: 'Python' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'go', label: 'Go' },
  { value: 'java', label: 'Java' },
  { value: 'c', label: 'C / C++' },
  { value: 'php', label: 'PHP' },
  { value: 'solidity', label: 'Solidity' },
];

interface CodeAuditorProps {
  initialCode?: string;
  onSendToAI?: (prompt: string) => void;
}

const SAMPLE_VULNERABILITIES = [
  {
    id: 'sqli',
    name: 'SQL Injection (CWE-89)',
    language: 'python',
    code: `import sqlite3

def get_user_profile(user_input):
    conn = sqlite3.connect('users.db')
    cursor = conn.cursor()
    # VULNERABLE: Direct string formatting into SQL query allows SQL Injection (CWE-89)
    query = f"SELECT * FROM users WHERE username = '{user_input}'"
    cursor.execute(query)
    return cursor.fetchall()
`,
    finding: {
      id: 'f-sqli',
      title: 'SQL Injection via Unsanitized Input Concatenation',
      severity: 'critical' as const,
      cweId: 'CWE-89',
      owaspCategory: 'A03:2021-Injection',
      file: 'app/controllers/user.py',
      lineStart: 7,
      lineEnd: 8,
      description:
        'User-controlled string "user_input" is directly formatted into an active SQL query, allowing attackers to execute arbitrary database commands or bypass authentication.',
      remediation:
        'Use parameterized queries (prepared statements) with placeholders to separate SQL syntax from untrusted parameters.',
      patchDiff: {
        original: '    query = f"SELECT * FROM users WHERE username = \'{user_input}\'"\n    cursor.execute(query)',
        patched: '    query = "SELECT * FROM users WHERE username = ?"\n    cursor.execute(query, (user_input,))',
      },
    },
  },
  {
    id: 'cmdi',
    name: 'Command Injection (CWE-78)',
    language: 'python',
    code: `import subprocess

def ping_host(host_ip):
    # VULNERABLE: shell=True with unvalidated user input enables OS Command Injection
    cmd = f"ping -c 1 {host_ip}"
    result = subprocess.check_output(cmd, shell=True)
    return result
`,
    finding: {
      id: 'f-cmdi',
      title: 'OS Command Injection in Ping Utility',
      severity: 'critical' as const,
      cweId: 'CWE-78',
      owaspCategory: 'A03:2021-Injection',
      file: 'utils/network.py',
      lineStart: 5,
      lineEnd: 6,
      description:
        'Passing unsanitized shell commands with `shell=True` permits shell metacharacters (e.g. `;`, `|`, `&&`) to execute arbitrary host commands.',
      remediation:
        'Avoid `shell=True` and pass arguments as an immutable list or validate input strictly against an IPv4/IPv6 regex.',
      patchDiff: {
        original: '    cmd = f"ping -c 1 {host_ip}"\n    result = subprocess.check_output(cmd, shell=True)',
        patched: '    import ipaddress\n    ipaddress.ip_address(host_ip) # Validate IP\n    result = subprocess.check_output(["ping", "-c", "1", host_ip])',
      },
    },
  },
  {
    id: 'ssrf',
    name: 'Server-Side Request Forgery (CWE-918)',
    language: 'javascript',
    code: `const express = require('express');
const axios = require('axios');
const app = express();

app.get('/fetch-url', async (req, res) => {
    const { targetUrl } = req.query;
    // VULNERABLE: Fetching unvalidated user-supplied URLs enables SSRF into internal networks (e.g. 169.254.169.254)
    const response = await axios.get(targetUrl);
    res.send(response.data);
});
`,
    finding: {
      id: 'f-ssrf',
      title: 'Server-Side Request Forgery (SSRF) via Dynamic Proxy Endpoint',
      severity: 'high' as const,
      cweId: 'CWE-918',
      owaspCategory: 'A10:2021-Server-Side Request Forgery',
      file: 'server/routes.js',
      lineStart: 7,
      lineEnd: 8,
      description:
        'The endpoint blindly executes HTTP requests to any user-supplied URI without verifying whether the destination resolves to private RFC1918 IPs or cloud metadata services.',
      remediation:
        'Validate destination against an explicit allowlist of domain names, and resolve DNS to block loopback (127.0.0.1) and private IP ranges before sending requests.',
      patchDiff: {
        original: '    const response = await axios.get(targetUrl);',
        patched: '    const parsed = new URL(targetUrl);\n    if (!ALLOWED_DOMAINS.includes(parsed.hostname)) return res.status(403).send("Forbidden");\n    const response = await axios.get(targetUrl, { timeout: 3000 });',
      },
    },
  },
];

function detectHeuristicVulnerabilities(sourceCode: string): VulnerabilityFinding[] {
  const results: VulnerabilityFinding[] = [];
  if (!sourceCode.trim()) return results;

  // 1. SQL Injection (CWE-89)
  if (/(?:f["'].*SELECT.*\{|cursor\.execute\(\s*f["']|SELECT\s+.*\s+FROM\s+.*\s+WHERE.*=\s*['"]\s*\+|["']SELECT\s+.*\s+FROM\s+.*\s+WHERE.*['"]\s*%\s*\()/i.test(sourceCode)) {
    results.push({
      id: 'detected-sqli',
      title: 'SQL Injection via Unsanitized Input Concatenation',
      severity: 'critical',
      cweId: 'CWE-89',
      owaspCategory: 'A03:2021-Injection',
      description: 'Dynamic string formatting or direct variable concatenation into SQL query allows attackers to execute arbitrary database queries or bypass authentication.',
      remediation: 'Use parameterized queries (prepared statements) with placeholders (? or %s) to safely separate SQL commands from untrusted user inputs.',
      patchDiff: {
        original: sourceCode.includes('f"SELECT') ? 'query = f"SELECT * FROM users WHERE username = \'{user_input}\'"\ncursor.execute(query)' : 'cursor.execute(query + user_input)',
        patched: 'query = "SELECT * FROM users WHERE username = ?"\ncursor.execute(query, (user_input,))',
      },
    });
  }

  // 2. Command Injection (CWE-78)
  if (/shell\s*=\s*True|os\.system\(|subprocess\.Popen\([^,)]*shell\s*=\s*True|os\.popen\(/i.test(sourceCode)) {
    results.push({
      id: 'detected-cmdi',
      title: 'OS Command Injection via Shell Execution',
      severity: 'critical',
      cweId: 'CWE-78',
      owaspCategory: 'A03:2021-Injection',
      description: 'Executing operating system commands with `shell=True` or `os.system()` allows attackers to inject shell metacharacters (e.g. `;`, `|`, `&&`) and run arbitrary host commands.',
      remediation: 'Avoid `shell=True`. Pass arguments as an array/list to `subprocess.run(["cmd", "arg"])` and avoid passing raw user input directly to the shell.',
      patchDiff: {
        original: 'cmd = f"ping -c 1 {host_ip}"\nresult = subprocess.check_output(cmd, shell=True)',
        patched: 'import ipaddress\nipaddress.ip_address(host_ip) # Validate IP\nresult = subprocess.check_output(["ping", "-c", "1", host_ip])',
      },
    });
  }

  // 3. Server-Side Request Forgery (SSRF / CWE-918)
  if (/(?:axios\.get|fetch|requests\.get|urllib\.request\.urlopen)\(\s*[a-zA-Z0-9_.]*(?:url|target|dest|endpoint|host)/i.test(sourceCode)) {
    results.push({
      id: 'detected-ssrf',
      title: 'Server-Side Request Forgery (SSRF) via Dynamic URL Fetch',
      severity: 'high',
      cweId: 'CWE-918',
      owaspCategory: 'A10:2021-Server-Side Request Forgery',
      description: 'Unvalidated user-supplied destination URL is fetched directly by the backend server, enabling attackers to probe internal microservices, private RFC1918 subnets, or cloud metadata endpoints (169.254.169.254).',
      remediation: 'Validate destination URLs against a strict domain allowlist and resolve DNS to block private IP ranges (127.0.0.0/8, 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 169.254.169.254).',
      patchDiff: {
        original: 'const response = await axios.get(targetUrl);',
        patched: 'const parsed = new URL(targetUrl);\nif (!ALLOWED_DOMAINS.includes(parsed.hostname)) return res.status(403).send("Forbidden");\nconst response = await axios.get(targetUrl, { timeout: 3000 });',
      },
    });
  }

  // 4. Cross-Site Scripting (XSS / CWE-79)
  if (/dangerouslySetInnerHTML|innerHTML\s*=|document\.write\(|\.html\(\s*[a-zA-Z0-9_.]*input/i.test(sourceCode)) {
    results.push({
      id: 'detected-xss',
      title: 'Cross-Site Scripting (XSS) via Unsanitized DOM Insertion',
      severity: 'high',
      cweId: 'CWE-79',
      owaspCategory: 'A03:2021-Injection',
      description: 'Inserting unescaped user-controlled HTML or JavaScript directly into the DOM allows malicious scripts to execute in the victim browser session.',
      remediation: 'Use `textContent` or `innerText` instead of `innerHTML`, or sanitize all HTML content using a library like DOMPurify before rendering.',
      patchDiff: {
        original: 'element.innerHTML = userContent;',
        patched: 'element.textContent = userContent; // Or DOMPurify.sanitize(userContent)',
      },
    });
  }

  // 5. Insecure Deserialization (CWE-502)
  if (/pickle\.loads\(|yaml\.load\([^,)]*\)|marshal\.loads\(/i.test(sourceCode)) {
    results.push({
      id: 'detected-deserialization',
      title: 'Insecure Deserialization of Untrusted Data',
      severity: 'critical',
      cweId: 'CWE-502',
      owaspCategory: 'A08:2021-Software and Data Integrity Failures',
      description: 'Deserializing untrusted data with Python `pickle` or `yaml.load()` permits arbitrary code execution during object construction.',
      remediation: 'Use safe structured data interchange formats like JSON, or `yaml.safe_load()` instead of `pickle` or standard `yaml.load()`.',
      patchDiff: {
        original: 'data = pickle.loads(user_payload)',
        patched: 'import json\ndata = json.loads(user_payload)',
      },
    });
  }

  // 6. Hardcoded Secrets / API Keys (CWE-798)
  if (/(?:api_key|secret_key|private_key|aws_secret|auth_token|db_password)\s*=\s*["'][a-zA-Z0-9_\-!@#$%^&*]{8,}["']|AKIA[0-9A-Z]{16}/i.test(sourceCode)) {
    results.push({
      id: 'detected-hardcoded-secret',
      title: 'Hardcoded Secret / API Token in Source Code',
      severity: 'high',
      cweId: 'CWE-798',
      owaspCategory: 'A07:2021-Identification and Authentication Failures',
      description: 'Cryptographic keys, database passwords, or cloud API tokens are committed directly into source code, exposing infrastructure to unauthorized access.',
      remediation: 'Extract credentials into environment variables or a secure secret manager and load them at runtime via `process.env` or `os.environ`.',
      patchDiff: {
        original: 'API_KEY = "sk-live-98a7sd8f7a9sd8f7a9s8df7a9sd"',
        patched: 'import os\nAPI_KEY = os.environ.get("API_KEY")',
      },
    });
  }

  return results;
}

function parseAIFindings(aiContent: string, sourceCode: string): VulnerabilityFinding[] {
  const heuristic = detectHeuristicVulnerabilities(sourceCode);
  if (!aiContent) return heuristic;

  // 1. Extract Title
  let title = '';
  const titleMatch = aiContent.match(/\*\*Vulnerability Title:\*\*\s*([^\n]+)/i);
  if (titleMatch) {
    title = titleMatch[1].replace(/[*#_`]/g, '').trim();
  } else {
    const genericTitleMatch = aiContent.match(/(?:#+\s*1?\s*\.?\s*|Title:\s*)([^\n]+(?:Injection|Vulnerability|XSS|SSRF|Bypass|Flaw|Overflow|Exposure|Deserialization|Sanitization|Traversal|Arbitrary|Execution|Control)[^\n]*)/i);
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
    description = descMatch ? descMatch[1].replace(/[*_`]/g, '').trim() : heuristic[0]?.description || 'Static analysis detected security risks in user input handling and active execution sinks.';
  }

  // 6. Extract Remediation
  let remediation = '';
  const remSectionMatch = aiContent.match(/(?:###\s*4\.\s*Recommended Secure Remediation[^\n]*\n+)([\s\S]*?)(?=####\s*Before|```|$)/i);
  if (remSectionMatch && remSectionMatch[1].trim()) {
    remediation = remSectionMatch[1].replace(/[*_`]/g, '').trim();
  } else {
    const remMatch = aiContent.match(/(?:Remediation|Recommendation|Fix|Remediated):\s*([^\n]+(?:\n[^\n#]+)?)/i);
    remediation = remMatch ? remMatch[1].replace(/[*_`]/g, '').trim() : heuristic[0]?.remediation || 'Apply secure input validation and safe coding practices.';
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

const CODE_AUDITOR_CODE_STORAGE_KEY = 'nexus_security_code_auditor_code';
const CODE_AUDITOR_LANG_STORAGE_KEY = 'nexus_security_code_auditor_lang';
const CODE_AUDITOR_FINDINGS_STORAGE_KEY = 'nexus_security_code_auditor_findings';

export default function CodeAuditor({
  initialCode,
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

  const [copiedPatchId, setCopiedPatchId] = useState<string | null>(null);
  const [appliedPatchId, setAppliedPatchId] = useState<string | null>(null);
  const [exportedFindingId, setExportedFindingId] = useState<string | null>(null);
  const [isAddingFinding, setIsAddingFinding] = useState(false);
  const [editorSize, setEditorSize] = useState<'normal' | 'expanded' | 'full'>('normal');
  const [newFinding, setNewFinding] = useState<{
    title: string;
    severity: VulnerabilitySeverity;
    cweId: string;
    description: string;
    remediation: string;
    originalDiff: string;
    patchedDiff: string;
  }>({
    title: '',
    severity: 'high',
    cweId: 'CWE-89',
    description: '',
    remediation: '',
    originalDiff: '',
    patchedDiff: '',
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
    if (!newFinding.title.trim()) return;
    const finding: VulnerabilityFinding = {
      id: `manual-finding-${Date.now()}`,
      title: newFinding.title.trim(),
      severity: newFinding.severity,
      cweId: newFinding.cweId.trim() || 'CWE-Other',
      description: newFinding.description.trim() || 'Identified during manual code review inspection.',
      remediation: newFinding.remediation.trim() || 'Implement secure validation and safe coding practices.',
      patchDiff: newFinding.originalDiff || newFinding.patchedDiff ? {
        original: newFinding.originalDiff,
        patched: newFinding.patchedDiff,
      } : undefined,
    };
    setFindings((prev) => [finding, ...prev]);
    setIsAddingFinding(false);
    setNewFinding({
      title: '',
      severity: 'high',
      cweId: 'CWE-89',
      description: '',
      remediation: '',
      originalDiff: '',
      patchedDiff: '',
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
  }, [initialCode]);

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

  const handleExportToReport = (finding: VulnerabilityFinding) => {
    try {
      const raw = localStorage.getItem('nexus_security_report');
      if (raw) {
        const report = JSON.parse(raw);
        const exists = report.findings?.some((f: { title: string }) => f.title === finding.title);
        if (!exists) {
          report.findings = report.findings || [];
          report.findings.push({
            id: `FINDING-00${report.findings.length + 1}`,
            title: finding.title,
            severity: finding.severity,
            cweId: finding.cweId || 'CWE-89',
            description: finding.description,
            remediation: finding.remediation,
            targetEndpoint: 'Source Code / Controller',
            patchDiff: finding.patchDiff,
          });
          localStorage.setItem('nexus_security_report', JSON.stringify(report));
        }
      }
      setExportedFindingId(finding.id);
      setTimeout(() => setExportedFindingId(null), 2000);
    } catch (e) {
      console.error(e);
    }
  };

  const copyPatch = (finding: VulnerabilityFinding) => {
    if (!finding.patchDiff) return;
    navigator.clipboard.writeText(finding.patchDiff.patched);
    setCopiedPatchId(finding.id);
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
      {/* Top Controls */}
      <div className={styles.topBar}>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <CustomSelect
            value=""
            placeholder="Sample Vulnerability Templates..."
            options={SAMPLE_VULNERABILITIES.map((s) => ({
              value: s.id,
              label: s.name,
              badge: s.language.toUpperCase(),
            }))}
            onChange={(val) => handleSelectSample(val)}
            style={{ minWidth: '220px' }}
          />
          <CustomSelect
            value={language}
            options={LANGUAGE_OPTIONS}
            onChange={(val) => setLanguage(val)}
            style={{ minWidth: '130px' }}
          />
        </div>

        <button
          className={`${styles.btn} ${styles.btnPrimary}`}
          onClick={handleAuditRequest}
          disabled={isAuditing}
        >
          {isAuditing ? (
            <>
              <Loader2 size={14} className="animate-spin" /> Auditing with AI...
            </>
          ) : (
            <>
              <Sparkles size={14} /> Audit with AppSec AI
            </>
          )}
        </button>
      </div>

      {/* Target Code Editor Area */}
      <div className={styles.editorCard}>
        <div className={styles.cardHeader}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <FileCode size={14} /> Target Source Code
          </span>
          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
            <button
              className={styles.btn}
              style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }}
              onClick={() => {
                const detected = detectHeuristicVulnerabilities(code);
                if (detected.length > 0) {
                  setFindings(detected);
                }
              }}
              title="Run instant client-side static security analysis"
            >
              <ShieldCheck size={11} color="#10b981" /> Scan Code
            </button>
            <button
              className={styles.btn}
              style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }}
              onClick={() => {
                setCode('');
                setFindings([]);
              }}
            >
              <RotateCcw size={11} /> Clear
            </button>
            <button
              className={styles.btn}
              style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }}
              onClick={() => {
                setEditorSize((prev) => (prev === 'normal' ? 'expanded' : prev === 'expanded' ? 'full' : 'normal'));
              }}
              title={editorSize === 'normal' ? 'Expand editor height (420px)' : editorSize === 'expanded' ? 'Full height (620px)' : 'Reset height (260px)'}
            >
              {editorSize === 'full' ? (
                <>
                  <Minimize2 size={11} /> Reset
                </>
              ) : (
                <>
                  <Maximize2 size={11} /> {editorSize === 'normal' ? 'Expand' : 'Full'}
                </>
              )}
            </button>
          </div>
        </div>
        <textarea
          className={styles.codeArea}
          style={{
            minHeight: editorSize === 'full' ? '600px' : editorSize === 'expanded' ? '420px' : '260px',
            height: editorSize === 'full' ? '600px' : editorSize === 'expanded' ? '420px' : '260px',
          }}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="// Paste source code to inspect for vulnerabilities and logic flaws..."
          spellCheck={false}
        />
      </div>

      {/* Vulnerability Findings & Diffs */}
      <div className={styles.findingsList}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.4rem' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            Detected Vulnerabilities & Remediation Diffs ({findings.length})
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
          <div
            className={styles.findingCard}
            style={{
              borderLeftColor: '#3b82f6',
              background: 'rgba(15, 23, 42, 0.95)',
              border: '1px solid rgba(255,255,255,0.12)',
              gap: '0.6rem',
            }}
          >
            <div style={{ fontWeight: 600, fontSize: '0.82rem', color: '#60a5fa' }}>
              📝 Record Custom Vulnerability Finding
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <div>
                <label style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block', marginBottom: '0.2rem' }}>
                  Finding Title
                </label>
                <input
                  style={{
                    width: '100%',
                    padding: '0.35rem 0.5rem',
                    fontSize: '0.75rem',
                    background: '#020617',
                    border: '1px solid rgba(255,255,255,0.12)',
                    color: '#fff',
                    borderRadius: '5px',
                    boxSizing: 'border-box',
                  }}
                  placeholder="e.g. Broken Access Control in Controller"
                  value={newFinding.title}
                  onChange={(e) => setNewFinding({ ...newFinding, title: e.target.value })}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block', marginBottom: '0.2rem' }}>
                  Severity &amp; CWE ID
                </label>
                <div style={{ display: 'flex', gap: '0.3rem' }}>
                  <CustomSelect
                    value={newFinding.severity}
                    options={[
                      { value: 'critical', label: 'Critical' },
                      { value: 'high', label: 'High' },
                      { value: 'medium', label: 'Medium' },
                      { value: 'low', label: 'Low' },
                      { value: 'info', label: 'Info' },
                    ]}
                    onChange={(val) => setNewFinding({ ...newFinding, severity: val as VulnerabilitySeverity })}
                    style={{ flex: 1 }}
                  />
                  <input
                    style={{
                      width: '90px',
                      padding: '0.35rem 0.5rem',
                      fontSize: '0.75rem',
                      background: '#020617',
                      border: '1px solid rgba(255,255,255,0.12)',
                      color: '#fff',
                      borderRadius: '5px',
                      boxSizing: 'border-box',
                    }}
                    placeholder="CWE-89"
                    value={newFinding.cweId}
                    onChange={(e) => setNewFinding({ ...newFinding, cweId: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block', marginBottom: '0.2rem' }}>
                Description &amp; Impact
              </label>
              <textarea
                style={{
                  width: '100%',
                  padding: '0.35rem 0.5rem',
                  fontSize: '0.75rem',
                  background: '#020617',
                  border: '1px solid rgba(255,255,255,0.12)',
                  color: '#fff',
                  borderRadius: '5px',
                  boxSizing: 'border-box',
                  resize: 'vertical',
                }}
                rows={2}
                placeholder="Explain the security risk and exploit scenario..."
                value={newFinding.description}
                onChange={(e) => setNewFinding({ ...newFinding, description: e.target.value })}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block', marginBottom: '0.2rem' }}>
                Remediation Guidance
              </label>
              <input
                style={{
                  width: '100%',
                  padding: '0.35rem 0.5rem',
                  fontSize: '0.75rem',
                  background: '#020617',
                  border: '1px solid rgba(255,255,255,0.12)',
                  color: '#fff',
                  borderRadius: '5px',
                  boxSizing: 'border-box',
                }}
                placeholder="How to fix this issue securely..."
                value={newFinding.remediation}
                onChange={(e) => setNewFinding({ ...newFinding, remediation: e.target.value })}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <div>
                <label style={{ fontSize: '0.7rem', color: '#f87171', display: 'block', marginBottom: '0.2rem' }}>
                  Original Insecure Lines (Diff Before)
                </label>
                <textarea
                  style={{
                    width: '100%',
                    padding: '0.35rem 0.5rem',
                    fontSize: '0.75rem',
                    background: '#020617',
                    border: '1px solid rgba(239,68,68,0.35)',
                    color: '#fca5a5',
                    borderRadius: '5px',
                    boxSizing: 'border-box',
                    fontFamily: 'monospace',
                  }}
                  rows={2}
                  placeholder="Paste vulnerable lines of code..."
                  value={newFinding.originalDiff}
                  onChange={(e) => setNewFinding({ ...newFinding, originalDiff: e.target.value })}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.7rem', color: '#4ade80', display: 'block', marginBottom: '0.2rem' }}>
                  Remediated Secure Lines (Diff After)
                </label>
                <textarea
                  style={{
                    width: '100%',
                    padding: '0.35rem 0.5rem',
                    fontSize: '0.75rem',
                    background: '#020617',
                    border: '1px solid rgba(16,185,129,0.35)',
                    color: '#86efac',
                    borderRadius: '5px',
                    boxSizing: 'border-box',
                    fontFamily: 'monospace',
                  }}
                  rows={2}
                  placeholder="Paste secure replacement lines..."
                  value={newFinding.patchedDiff}
                  onChange={(e) => setNewFinding({ ...newFinding, patchedDiff: e.target.value })}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.4rem', marginTop: '0.3rem' }}>
              <button className={styles.btn} onClick={() => setIsAddingFinding(false)}>
                Cancel
              </button>
              <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleSaveCustomFinding}>
                Save Finding
              </button>
            </div>
          </div>
        )}

        {findings.map((finding) => (
          <div
            key={finding.id}
            className={`${styles.findingCard} ${styles[finding.severity]}`}
          >
            <div className={styles.findingHeader}>
              <span className={styles.findingTitle}>
                <ShieldAlert size={16} /> {finding.title}
              </span>
              <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                {finding.cweId && (
                  <span className={`${styles.badge} ${styles[finding.severity]}`}>
                    {finding.cweId}
                  </span>
                )}
                <span className={`${styles.badge} ${styles[finding.severity]}`}>
                  {finding.severity}
                </span>
                <button
                  className={styles.btn}
                  style={{ padding: '0.15rem 0.4rem', color: '#ef4444' }}
                  onClick={() => handleDeleteFinding(finding.id)}
                  title="Remove finding"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>

            <p className={styles.findingDesc}>{finding.description}</p>
            <p className={styles.findingDesc} style={{ color: '#a7f3d0' }}>
              <strong>Remediation:</strong> {finding.remediation}
            </p>

            {finding.patchDiff && (
              <>
                <div className={styles.diffContainer}>
                  <div className={`${styles.diffBlock} ${styles.diffOriginal}`}>
                    <div style={{ fontWeight: 600, marginBottom: '0.2rem', color: '#f87171' }}>
                      Insecure (Original)
                    </div>
                    {finding.patchDiff.original}
                  </div>
                  <div className={`${styles.diffBlock} ${styles.diffPatched}`}>
                    <div style={{ fontWeight: 600, marginBottom: '0.2rem', color: '#34d399' }}>
                      Remediated (Secure)
                    </div>
                    {finding.patchDiff.patched}
                  </div>
                </div>

                <div className={styles.actionRow} style={{ marginTop: '0.25rem' }}>
                  <button
                    className={styles.btn}
                    onClick={() => applyPatch(finding)}
                    title="Apply secure fix diff directly into the editor code above"
                    style={{
                      borderColor: appliedPatchId === finding.id ? '#10b981' : undefined,
                      color: appliedPatchId === finding.id ? '#34d399' : undefined,
                    }}
                  >
                    {appliedPatchId === finding.id ? <Check size={12} color="#10b981" /> : <GitPullRequest size={12} />}
                    {appliedPatchId === finding.id ? '✓ Patch Applied' : 'Apply Patch to Code'}
                  </button>
                  <button
                    className={styles.btn}
                    onClick={() => copyPatch(finding)}
                  >
                    {copiedPatchId === finding.id ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                    {copiedPatchId === finding.id ? 'Copied' : 'Copy Patch'}
                  </button>
                  <button
                    className={styles.btn}
                    onClick={() => handleExportToReport(finding)}
                    title="Export finding to VAPT Report Studio"
                  >
                    {exportedFindingId === finding.id ? <Check size={12} color="#10b981" /> : <FileText size={12} color="#60a5fa" />}
                    {exportedFindingId === finding.id ? 'Added to Report' : 'Add to Report'}
                  </button>
                </div>
              </>
            )}
          </div>
        ))}

        {findings.length === 0 && (
          <div
            style={{
              padding: '1.75rem 1.25rem',
              textAlign: 'center',
              color: 'var(--text-muted)',
              background: 'var(--card-glass)',
              borderRadius: '8px',
              border: '1px dashed var(--card-border)',
            }}
          >
            <ShieldCheck size={28} style={{ opacity: 0.5, marginBottom: '0.5rem', color: '#60a5fa' }} />
            <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem', fontSize: '0.85rem' }}>
              Ready for Security Audit
            </div>
            <div style={{ fontSize: '0.78rem', lineHeight: '1.5' }}>
              Paste code above and click <strong>"Audit with AppSec AI"</strong>, load a preset template, or click <strong>"+ Add Finding"</strong> to record manual review findings.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
