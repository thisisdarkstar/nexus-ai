import type { VulnerabilityFinding } from '../../types';

interface SastRule {
  id: string;
  title: string;
  cweId: string;
  owaspCategory: string;
  severity: VulnerabilityFinding['severity'];
  pattern: RegExp;
  languages?: string[];
  description: string;
  remediation: string;
  generatePatch?: (matchLine: string) => { original: string; patched: string };
}

const SAST_RULES: SastRule[] = [
  // 1. SQL Injection
  {
    id: 'sast-sqli-python',
    title: 'SQL Injection via String Formatting (Python)',
    cweId: 'CWE-89',
    owaspCategory: 'A03:2021-Injection',
    severity: 'critical',
    pattern: /(?:execute|cursor\.execute)\s*\(\s*f["']SELECT|f["']INSERT|f["']UPDATE|f["']DELETE|%\s*\([a-zA-Z0-9_]+\)/i,
    languages: ['python'],
    description: 'Dynamic formatting of user variables directly into a SQL query string enables SQL Injection.',
    remediation: 'Use parameterized queries with placeholders (? or %s) and pass variables as a separate tuple/array.',
    generatePatch: (line) => ({
      original: line,
      patched: line.replace(/f(["'].*?\{([a-zA-Z0-9_]+)\}.*?["'])/, '"SELECT * FROM target WHERE id = ?"), ($2,)'),
    }),
  },
  {
    id: 'sast-sqli-js',
    title: 'SQL Injection via String Concatenation (JS/TS)',
    cweId: 'CWE-89',
    owaspCategory: 'A03:2021-Injection',
    severity: 'critical',
    pattern: /(?:query|execute)\s*\(\s*`\s*(?:SELECT|INSERT|UPDATE|DELETE)[^`]*\$\{/i,
    languages: ['javascript', 'typescript'],
    description: 'Template literal interpolation into a database query enables arbitrary SQL execution.',
    remediation: 'Use prepared statements or an ORM with parameter bindings ($1, $2 or ?).',
  },

  // 2. Command Injection
  {
    id: 'sast-cmdi-shell-true',
    title: 'OS Command Injection via shell=True (Python)',
    cweId: 'CWE-78',
    owaspCategory: 'A03:2021-Injection',
    severity: 'critical',
    pattern: /(?:subprocess\.Popen|subprocess\.run|subprocess\.check_output|subprocess\.call)\s*\([^)]*shell\s*=\s*True/i,
    languages: ['python'],
    description: 'Executing subprocess commands with `shell=True` permits shell metacharacters (; | &&) to trigger OS command injection.',
    remediation: 'Pass command arguments as an explicit array without `shell=True` (e.g. ["ping", "-c", "1", host]).',
    generatePatch: (line) => ({
      original: line,
      patched: line.replace(/shell\s*=\s*True/, 'shell=False'),
    }),
  },
  {
    id: 'sast-cmdi-exec-js',
    title: 'OS Command Injection via child_process.exec (Node.js)',
    cweId: 'CWE-78',
    owaspCategory: 'A03:2021-Injection',
    severity: 'critical',
    pattern: /(?:exec|execSync)\s*\(\s*`[^`]*\$\{|(?:exec|execSync)\s*\([^)]*\+/i,
    languages: ['javascript', 'typescript'],
    description: 'Passing concatenated strings to `child_process.exec()` allows shell injection.',
    remediation: 'Use `execFile` or `spawn` with an array of arguments to prevent shell interpolation.',
  },

  // 3. Hardcoded Secrets
  {
    id: 'sast-secret-aws-key',
    title: 'Hardcoded AWS Access Key',
    cweId: 'CWE-798',
    owaspCategory: 'A07:2021-Identification and Authentication Failures',
    severity: 'critical',
    pattern: /(?:AKIA[0-9A-Z]{16})/i,
    description: 'Hardcoded cloud provider access credentials found in source code.',
    remediation: 'Remove credentials from source control and load via secure environment variables or a Secret Manager.',
  },
  {
    id: 'sast-secret-generic',
    title: 'Hardcoded API Secret / Private Key',
    cweId: 'CWE-798',
    owaspCategory: 'A07:2021-Identification and Authentication Failures',
    severity: 'high',
    pattern: /(?:api_key|apikey|secret_key|jwt_secret|password)\s*=\s*["'][a-zA-Z0-9_\-!@#$%^&*]{8,}["']/i,
    description: 'Plaintext API key or credential string discovered hardcoded in codebase.',
    remediation: 'Load secrets from environment variables (process.env / os.environ).',
  },

  // 4. Insecure Deserialization
  {
    id: 'sast-deserial-python',
    title: 'Insecure Deserialization via pickle.loads',
    cweId: 'CWE-502',
    owaspCategory: 'A08:2021-Software and Data Integrity Failures',
    severity: 'critical',
    pattern: /pickle\.loads?\s*\(/i,
    languages: ['python'],
    description: 'Unpickling untrusted data can lead to Remote Code Execution (RCE) via custom __reduce__ methods.',
    remediation: 'Use safe data serialization formats like JSON or Protocol Buffers instead of pickle.',
  },
  {
    id: 'sast-deserial-yaml',
    title: 'Arbitrary Code Execution via Unsafe YAML Loader',
    cweId: 'CWE-502',
    owaspCategory: 'A08:2021-Software and Data Integrity Failures',
    severity: 'high',
    pattern: /yaml\.load\s*\([^)]*Loader\s*=\s*(?:yaml\.Loader|yaml\.UnsafeLoader)/i,
    languages: ['python'],
    description: 'Loading YAML with unsafe loaders permits object instantiation and code execution.',
    remediation: 'Use `yaml.safe_load(data)` instead.',
    generatePatch: (line) => ({
      original: line,
      patched: line.replace(/yaml\.load\s*\(([^,]+),[^)]*\)/, 'yaml.safe_load($1)'),
    }),
  },

  // 5. Cross-Site Scripting (XSS)
  {
    id: 'sast-xss-innerhtml',
    title: 'DOM-based XSS via innerHTML Assignment',
    cweId: 'CWE-79',
    owaspCategory: 'A03:2021-Injection',
    severity: 'high',
    pattern: /\.innerHTML\s*=\s*|\$\([^)]+\)\.html\s*\(/i,
    languages: ['javascript', 'typescript'],
    description: 'Directly assigning unescaped strings to `innerHTML` allows Cross-Site Scripting (XSS).',
    remediation: 'Use `textContent`, DOMPurify sanitization, or framework-managed text bindings.',
    generatePatch: (line) => ({
      original: line,
      patched: line.replace(/\.innerHTML\s*=/, '.textContent ='),
    }),
  },
  {
    id: 'sast-xss-react',
    title: 'Potential XSS via dangerouslySetInnerHTML',
    cweId: 'CWE-79',
    owaspCategory: 'A03:2021-Injection',
    severity: 'medium',
    pattern: /dangerouslySetInnerHTML\s*=\s*\{\s*\{\s*__html\s*:/i,
    languages: ['javascript', 'typescript'],
    description: 'Bypassing React HTML escaping without strict sanitization exposes users to stored/DOM XSS.',
    remediation: 'Sanitize content with DOMPurify before passing to `__html`.',
  },

  // 6. Insecure TLS / SSL
  {
    id: 'sast-tls-verify-false',
    title: 'TLS Certificate Verification Disabled',
    cweId: 'CWE-295',
    owaspCategory: 'A02:2021-Cryptographic Failures',
    severity: 'high',
    pattern: /(?:verify\s*=\s*False|rejectUnauthorized\s*:\s*false|NODE_TLS_REJECT_UNAUTHORIZED\s*=\s*['"]0['"])/i,
    description: 'Disabling SSL/TLS verification permits Man-in-the-Middle (MitM) traffic interception.',
    remediation: 'Enable certificate validation and provide proper trusted CA certificate bundles.',
    generatePatch: (line) => ({
      original: line,
      patched: line.replace(/verify\s*=\s*False/i, 'verify=True').replace(/rejectUnauthorized\s*:\s*false/i, 'rejectUnauthorized: true'),
    }),
  },

  // 7. Weak Cryptography
  {
    id: 'sast-crypto-weak-hash',
    title: 'Use of Broken Cryptographic Hash (MD5 / SHA-1)',
    cweId: 'CWE-327',
    owaspCategory: 'A02:2021-Cryptographic Failures',
    severity: 'medium',
    pattern: /(?:hashlib\.md5|hashlib\.sha1|crypto\.createHash\s*\(\s*["'](?:md5|sha1)["']\))/i,
    description: 'MD5 and SHA-1 suffer from collision attacks and should never be used for security purposes.',
    remediation: 'Upgrade to SHA-256 or SHA-3 for digests, or bcrypt/Argon2 for password hashing.',
  },

  // 8. Arbitrary Code Evaluation
  {
    id: 'sast-eval-usage',
    title: 'Arbitrary Dynamic Code Execution (eval / exec)',
    cweId: 'CWE-94',
    owaspCategory: 'A03:2021-Injection',
    severity: 'critical',
    pattern: /(?:(?<!\.)\beval\s*\(|(?<!\.)\bexec\s*\(|new\s+Function\s*\()/i,
    description: 'Direct invocation of code evaluation constructs on variable input enables arbitrary execution.',
    remediation: 'Refactor code to use explicit data structures or safe parsers (e.g. JSON.parse).',
  },

  // 9. Path Traversal
  {
    id: 'sast-path-traversal',
    title: 'Potential Path Traversal in File Operations',
    cweId: 'CWE-22',
    owaspCategory: 'A01:2021-Broken Access Control',
    severity: 'high',
    pattern: /(?:fs\.readFile|fs\.readFileSync|open)\s*\([^)]*(?:req\.params|req\.query|req\.body|user_input)/i,
    description: 'Opening files with unvalidated user input permits directory traversal (e.g. ../../../etc/passwd).',
    remediation: 'Resolve canonical paths with `path.resolve()` and verify that the target starts with the allowed root directory.',
  },
];

/**
 * Scan source code locally and return structured security findings
 */
export function scanSourceCode(code: string, language: string = 'python'): VulnerabilityFinding[] {
  if (!code || !code.trim()) return [];

  const findings: VulnerabilityFinding[] = [];
  const lines = code.split('\n');

  SAST_RULES.forEach((rule) => {
    // If language is specified, check compatibility
    if (rule.languages && !rule.languages.includes(language.toLowerCase())) {
      return;
    }

    lines.forEach((lineText, idx) => {
      if (rule.pattern.test(lineText)) {
        const lineNum = idx + 1;
        const patch = rule.generatePatch ? rule.generatePatch(lineText) : undefined;

        findings.push({
          id: `finding-${rule.id}-${lineNum}`,
          title: rule.title,
          severity: rule.severity,
          cweId: rule.cweId,
          owaspCategory: rule.owaspCategory,
          file: `snippet.${language === 'python' ? 'py' : language === 'javascript' ? 'js' : language === 'typescript' ? 'ts' : 'txt'}`,
          lineStart: lineNum,
          lineEnd: lineNum,
          description: rule.description,
          remediation: rule.remediation,
          patchDiff: patch,
          status: 'open',
        });
      }
    });
  });

  return findings;
}

