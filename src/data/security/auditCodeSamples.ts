import type { VulnerabilityFinding } from '../../types';

export interface AuditSample {
  id: string;
  name: string;
  language: string;
  code: string;
  finding: VulnerabilityFinding;
}

export const LANGUAGE_OPTIONS = [
  { value: 'python', label: 'Python' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'go', label: 'Go' },
  { value: 'java', label: 'Java' },
  { value: 'c', label: 'C / C++' },
  { value: 'php', label: 'PHP' },
  { value: 'solidity', label: 'Solidity' },
];

export const SAMPLE_VULNERABILITIES: AuditSample[] = [
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
      severity: 'critical',
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
      severity: 'critical',
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
      severity: 'high',
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

export function detectHeuristicVulnerabilities(sourceCode: string): VulnerabilityFinding[] {
  const results: VulnerabilityFinding[] = [];
  if (!sourceCode.trim()) return results;

  // 1. SQL Injection (CWE-89)
  if (
    /(?:f["'].*SELECT.*\{|cursor\.execute\(\s*f["']|SELECT\s+.*\s+FROM\s+.*\s+WHERE.*=\s*['"]\s*\+|["']SELECT\s+.*\s+FROM\s+.*\s+WHERE.*['"]\s*%\s*\()/i.test(
      sourceCode
    )
  ) {
    results.push({
      id: 'detected-sqli',
      title: 'SQL Injection via Unsanitized Input Concatenation',
      severity: 'critical',
      cweId: 'CWE-89',
      owaspCategory: 'A03:2021-Injection',
      description:
        'Dynamic string formatting or direct variable concatenation into SQL query allows attackers to execute arbitrary database queries or bypass authentication.',
      remediation:
        'Use parameterized queries (prepared statements) with placeholders (? or %s) to safely separate SQL commands from untrusted user inputs.',
      patchDiff: {
        original: sourceCode.includes('f"SELECT')
          ? 'query = f"SELECT * FROM users WHERE username = \'{user_input}\'"\ncursor.execute(query)'
          : 'cursor.execute(query + user_input)',
        patched:
          'query = "SELECT * FROM users WHERE username = ?"\ncursor.execute(query, (user_input,))',
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
      description:
        'Executing operating system commands with `shell=True` or `os.system()` allows attackers to inject shell metacharacters (e.g. `;`, `|`, `&&`) and run arbitrary host commands.',
      remediation:
        'Avoid `shell=True`. Pass arguments as an array/list to `subprocess.run(["cmd", "arg"])` and avoid passing raw user input directly to the shell.',
      patchDiff: {
        original: 'cmd = f"ping -c 1 {host_ip}"\nresult = subprocess.check_output(cmd, shell=True)',
        patched:
          'import ipaddress\nipaddress.ip_address(host_ip) # Validate IP\nresult = subprocess.check_output(["ping", "-c", "1", host_ip])',
      },
    });
  }

  // 3. Server-Side Request Forgery (SSRF / CWE-918)
  if (
    /(?:axios\.get|fetch|requests\.get|urllib\.request\.urlopen)\(\s*[a-zA-Z0-9_.]*(?:url|target|dest|endpoint|host)/i.test(
      sourceCode
    )
  ) {
    results.push({
      id: 'detected-ssrf',
      title: 'Server-Side Request Forgery (SSRF) via Dynamic URL Fetch',
      severity: 'high',
      cweId: 'CWE-918',
      owaspCategory: 'A10:2021-Server-Side Request Forgery',
      description:
        'Unvalidated user-supplied destination URL is fetched directly by the backend server, enabling attackers to probe internal microservices, private RFC1918 subnets, or cloud metadata endpoints (169.254.169.254).',
      remediation:
        'Validate destination URLs against a strict domain allowlist and resolve DNS to block private IP ranges (127.0.0.0/8, 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 169.254.169.254).',
      patchDiff: {
        original: 'const response = await axios.get(targetUrl);',
        patched:
          'const parsed = new URL(targetUrl);\nif (!ALLOWED_DOMAINS.includes(parsed.hostname)) return res.status(403).send("Forbidden");\nconst response = await axios.get(targetUrl, { timeout: 3000 });',
      },
    });
  }

  // 4. Cross-Site Scripting (XSS / CWE-79)
  if (
    /dangerouslySetInnerHTML|innerHTML\s*=|document\.write\(|\.html\(\s*[a-zA-Z0-9_.]*input/i.test(
      sourceCode
    )
  ) {
    results.push({
      id: 'detected-xss',
      title: 'Cross-Site Scripting (XSS) via Unsanitized DOM Insertion',
      severity: 'high',
      cweId: 'CWE-79',
      owaspCategory: 'A03:2021-Injection',
      description:
        'Inserting unescaped user-controlled HTML or JavaScript directly into the DOM allows malicious scripts to execute in the victim browser session.',
      remediation:
        'Use `textContent` or `innerText` instead of `innerHTML`, or sanitize all HTML content using a library like DOMPurify before rendering.',
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
      description:
        'Deserializing untrusted data with Python `pickle` or `yaml.load()` permits arbitrary code execution during object construction.',
      remediation:
        'Use safe structured data interchange formats like JSON, or `yaml.safe_load()` instead of `pickle` or standard `yaml.load()`.',
      patchDiff: {
        original: 'data = pickle.loads(user_payload)',
        patched: 'import json\ndata = json.loads(user_payload)',
      },
    });
  }

  // 6. Hardcoded Secrets / API Keys (CWE-798)
  if (
    /(?:api_key|secret_key|private_key|aws_secret|auth_token|db_password)\s*=\s*["'][a-zA-Z0-9_\-!@#$%^&*]{8,}["']|AKIA[0-9A-Z]{16}/i.test(
      sourceCode
    )
  ) {
    results.push({
      id: 'detected-hardcoded-secret',
      title: 'Hardcoded Secret / API Token in Source Code',
      severity: 'high',
      cweId: 'CWE-798',
      owaspCategory: 'A07:2021-Identification and Authentication Failures',
      description:
        'Cryptographic keys, database passwords, or cloud API tokens are committed directly into source code, exposing infrastructure to unauthorized access.',
      remediation:
        'Extract credentials into environment variables or a secure secret manager and load them at runtime via `process.env` or `os.environ`.',
      patchDiff: {
        original: 'API_KEY = "sk-live-98a7sd8f7a9sd8f7a9s8df7a9sd"',
        patched: 'import os\nAPI_KEY = os.environ.get("API_KEY")',
      },
    });
  }

  return results;
}
