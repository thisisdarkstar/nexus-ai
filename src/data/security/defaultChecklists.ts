import type { SecurityChecklistItem } from '../../types';

export interface ChecklistSuite {
  label: string;
  items: SecurityChecklistItem[];
}

export const SAMPLE_JSON_CHECKLIST = `[
  {
    "code": "AUTH-01",
    "title": "Broken Object-Level Authorization (BOLA/IDOR)",
    "category": "OWASP API Security",
    "description": "Verify that user A cannot access or mutate resources belonging to user B by altering IDs in URLs/payloads.",
    "status": "untested"
  },
  {
    "code": "INJ-02",
    "title": "SQL & NoSQL Injection in Search Parameters",
    "category": "Input Validation",
    "description": "Evaluate input parameters and headers for blind, error-based, and stacked SQLi vectors.",
    "status": "untested"
  },
  {
    "code": "SSRF-03",
    "title": "Server-Side Request Forgery on Webhook Endpoints",
    "category": "Server-Side Flaws",
    "description": "Test webhook and file fetch endpoints against cloud metadata (169.254.169.254) and localhost.",
    "status": "untested"
  }
]`;

export const SUITE_OPTIONS = [
  { value: 'core4', label: '🎯 Core 4 Essentials', badge: 'Core' },
  { value: 'wstg_full', label: '🛡️ OWASP WSTG v4.2 (8 Tests)', badge: 'Web' },
  { value: 'api_top10', label: '⚡ OWASP API Top 10 (7 Tests)', badge: 'API' },
];

export const CHECKLIST_SUITES: Record<string, ChecklistSuite> = {
  core4: {
    label: '🎯 Core 4 Essentials',
    items: [
      {
        id: 'wstg-info-01',
        category: 'OWASP WSTG - Reconnaissance',
        code: 'WSTG-INFO-01',
        title: 'Search Engine Discovery & OSINT Reconnaissance',
        description: 'Enumerate sensitive indexed URLs, leaked credentials on GitHub, and cached endpoints.',
        status: 'untested',
      },
      {
        id: 'wstg-authz-02',
        category: 'OWASP WSTG - Authorization',
        code: 'WSTG-AUTHZ-02',
        title: 'Test for Broken Object Level Authorization (BOLA/IDOR)',
        description: 'Verify if changing object IDs (e.g. user_id, order_id) allows unauthorized access to private data.',
        status: 'untested',
      },
      {
        id: 'wstg-inpv-05',
        category: 'OWASP WSTG - Input Validation',
        code: 'WSTG-INPV-05',
        title: 'Test for SQL & NoSQL Injection',
        description: 'Evaluate input parameters, headers, and JSON bodies for blind, error-based, and stacked SQLi.',
        status: 'untested',
      },
      {
        id: 'wstg-inpv-11',
        category: 'OWASP WSTG - Input Validation',
        code: 'WSTG-INPV-11',
        title: 'Test for Server-Side Request Forgery (SSRF)',
        description: 'Evaluate webhook URLs, PDF renderers, and image proxy endpoints for internal IP access.',
        status: 'untested',
      },
    ],
  },
  wstg_full: {
    label: '🛡️ OWASP WSTG v4.2 (Full Suite)',
    items: [
      {
        id: 'wstg-info-01',
        category: 'OWASP WSTG - Reconnaissance',
        code: 'WSTG-INFO-01',
        title: 'Search Engine Discovery & OSINT Reconnaissance',
        description: 'Enumerate sensitive indexed URLs, leaked credentials on GitHub, and cached endpoints.',
        status: 'untested',
      },
      {
        id: 'wstg-info-02',
        category: 'OWASP WSTG - Reconnaissance',
        code: 'WSTG-INFO-02',
        title: 'Fingerprint Web Server & Backend Tech Stack',
        description: 'Inspect HTTP response headers, error stack traces, and framework cookie signatures.',
        status: 'untested',
      },
      {
        id: 'wstg-authz-02',
        category: 'OWASP WSTG - Authorization',
        code: 'WSTG-AUTHZ-02',
        title: 'Test for Broken Object Level Authorization (BOLA/IDOR)',
        description: 'Verify if changing object IDs (e.g. user_id, order_id) allows unauthorized access to private data.',
        status: 'untested',
      },
      {
        id: 'wstg-inpv-05',
        category: 'OWASP WSTG - Input Validation',
        code: 'WSTG-INPV-05',
        title: 'Test for SQL & NoSQL Injection',
        description: 'Evaluate input parameters, headers, and JSON bodies for blind, error-based, and stacked SQLi.',
        status: 'untested',
      },
      {
        id: 'wstg-inpv-07',
        category: 'OWASP WSTG - Input Validation',
        code: 'WSTG-INPV-07',
        title: 'Test for Cross-Site Scripting (XSS)',
        description: 'Verify contextual output encoding across reflected parameters, stored data, and DOM sinks.',
        status: 'untested',
      },
      {
        id: 'wstg-inpv-11',
        category: 'OWASP WSTG - Input Validation',
        code: 'WSTG-INPV-11',
        title: 'Test for Server-Side Request Forgery (SSRF)',
        description: 'Evaluate webhook URLs, PDF renderers, and image proxy endpoints for internal IP access.',
        status: 'untested',
      },
      {
        id: 'wstg-conf-04',
        category: 'OWASP WSTG - Configuration',
        code: 'WSTG-CONF-04',
        title: 'Review Old, Backup and Unreferenced Files',
        description: 'Check for .bak, .git, .env, and swagger documentation leaks on public paths.',
        status: 'untested',
      },
      {
        id: 'wstg-cryp-03',
        category: 'OWASP WSTG - Cryptography',
        code: 'WSTG-CRYP-03',
        title: 'Test for Weak SSL/TLS Ciphers & HSTS',
        description: 'Audit transport layer encryption, obsolete TLS 1.0/1.1 protocols, and missing HSTS.',
        status: 'untested',
      },
    ],
  },
  api_top10: {
    label: '⚡ OWASP API Security Top 10 (2023)',
    items: [
      {
        id: 'api-1-2023',
        category: 'OWASP API Security Top 10',
        code: 'API1:2023',
        title: 'Broken Object Level Authorization (BOLA)',
        description: 'Test all REST & GraphQL query endpoints with horizontal authorization matrix.',
        status: 'untested',
      },
      {
        id: 'api-2-2023',
        category: 'OWASP API Security Top 10',
        code: 'API2:2023',
        title: 'Broken Authentication & Token Expiration',
        description: 'Inspect JWT signature verification, secret strength, and token expiration handling.',
        status: 'untested',
      },
      {
        id: 'api-3-2023',
        category: 'OWASP API Security Top 10',
        code: 'API3:2023',
        title: 'Broken Object Property Level Authorization',
        description: 'Check mass assignment and sensitive property exposure in response bodies.',
        status: 'untested',
      },
      {
        id: 'api-4-2023',
        category: 'OWASP API Security Top 10',
        code: 'API4:2023',
        title: 'Unrestricted Resource Consumption & Rate Limiting',
        description: 'Evaluate API endpoints for brute force, high-cost GraphQL queries, and payload limits.',
        status: 'untested',
      },
      {
        id: 'api-5-2023',
        category: 'OWASP API Security Top 10',
        code: 'API5:2023',
        title: 'Broken Function Level Authorization (BFLA)',
        description: 'Verify if administrative API functions can be invoked by regular authenticated users.',
        status: 'untested',
      },
      {
        id: 'api-7-2023',
        category: 'OWASP API Security Top 10',
        code: 'API7:2023',
        title: 'Security Misconfiguration (CORS, Debug Endpoints)',
        description: 'Audit CORS headers (Access-Control-Allow-Origin: * with credentials) and exposed swagger.json.',
        status: 'untested',
      },
      {
        id: 'api-8-2023',
        category: 'OWASP API Security Top 10',
        code: 'API8:2023',
        title: 'Server Side Request Forgery (SSRF) in API Webhooks',
        description: 'Inspect custom webhook callbacks and remote file fetching endpoints for internal SSRF.',
        status: 'untested',
      },
    ],
  },
};
