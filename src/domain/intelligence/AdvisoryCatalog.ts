export interface SecurityAdvisory {
  id: string;
  title: string;
  cweId: string;
  owaspCategory: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  affectedTechnologies: string[];
  description: string;
  defensiveCheck: string;
  remediationPattern: string;
  references: string[];
}

export const ADVISORY_CATALOG: SecurityAdvisory[] = [
  {
    id: 'ADV-SPRING-ACTUATOR',
    title: 'Spring Boot Actuator Configuration Exposure',
    cweId: 'CWE-200',
    owaspCategory: 'A05:2021-Security Misconfiguration',
    severity: 'critical',
    affectedTechnologies: ['Spring Boot', 'Spring Framework', 'Java'],
    description:
      'Exposed Spring Boot Actuator endpoints (/actuator/env, /actuator/heapdump, /actuator/gateway) disclose sensitive environment variables, credentials, database connection strings, and application configuration.',
    defensiveCheck:
      'Verify whether actuator endpoints return 200 OK without authentication. Probe with non-invasive GET /actuator/health to verify if full details are exposed.',
    remediationPattern:
      'In application.properties: set management.endpoints.web.exposure.include=health,info and require authenticated role access for administrative endpoints.',
    references: [
      'https://cwe.mitre.org/data/definitions/200.html',
      'https://docs.spring.io/spring-boot/docs/current/reference/html/actuator.html#actuator.endpoints.security',
    ],
  },
  {
    id: 'ADV-SSRF-PARAM',
    title: 'Server-Side Request Forgery (SSRF) via Destination Parameter',
    cweId: 'CWE-918',
    owaspCategory: 'A10:2021-Server-Side Request Forgery',
    severity: 'high',
    affectedTechnologies: ['Node.js', 'Express', 'Python', 'Go', 'PHP', 'Java'],
    description:
      'Endpoints accepting URL or destination parameters (url=, dest=, webhook=, target=) may allow unauthenticated attackers to coerce the server into sending requests to internal metadata services or internal networks.',
    defensiveCheck:
      'Inspect if the destination URL is validated against a strict domain whitelist before dispatching HTTP client calls.',
    remediationPattern:
      'Enforce an allowlist of permitted domain names and protocols (https only). Disable automatic HTTP redirects, and reject loopback (127.0.0.1, ::1) or cloud metadata IP ranges (169.254.169.254).',
    references: [
      'https://cwe.mitre.org/data/definitions/918.html',
      'https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html',
    ],
  },
  {
    id: 'ADV-IDOR-BOLA',
    title: 'Broken Object-Level Authorization (BOLA / IDOR)',
    cweId: 'CWE-639',
    owaspCategory: 'A01:2021-Broken Access Control',
    severity: 'high',
    affectedTechnologies: ['REST API', 'FastAPI', 'Express', 'Django', 'Spring Boot'],
    description:
      'API endpoints referencing record or account identifiers (user_id=, account_id=, id=) fail to validate whether the authenticated user token has ownership rights to the requested resource.',
    defensiveCheck:
      'Verify if requests with user A credentials can access or modify object records belonging to user B.',
    remediationPattern:
      'Enforce record-level authorization checks at the data-access layer comparing the authenticated session user claim with the record owner attribute.',
    references: [
      'https://cwe.mitre.org/data/definitions/639.html',
      'https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/',
    ],
  },
  {
    id: 'ADV-GRAPHQL-INTROSPECTION',
    title: 'GraphQL Schema Introspection Enabled in Production',
    cweId: 'CWE-200',
    owaspCategory: 'A05:2021-Security Misconfiguration',
    severity: 'medium',
    affectedTechnologies: ['GraphQL', 'Apollo Server', 'Yoga', 'Hasura'],
    description:
      'GraphQL introspection query (__schema) is accessible to unauthenticated callers, exposing all queries, mutations, types, and internal data structures.',
    defensiveCheck:
      'Execute a POST with { "__schema": { "types": { "name": true } } } to verify if schema reflection is permitted.',
    remediationPattern:
      'Disable introspection in production deployments: set introspection: false in Apollo Server or GraphQL engine configuration.',
    references: [
      'https://cheatsheetseries.owasp.org/cheatsheets/GraphQL_Cheat_Sheet.html',
    ],
  },
  {
    id: 'ADV-EXPOSED-CONFIG',
    title: 'Publicly Accessible Environment / Source Configuration (.env / .git)',
    cweId: 'CWE-552',
    owaspCategory: 'A05:2021-Security Misconfiguration',
    severity: 'critical',
    affectedTechnologies: ['Apache', 'Nginx', 'PHP', 'Node.js'],
    description:
      'Direct HTTP accessibility of version control repositories (.git/config) or environment files (.env) leaks database passwords, encryption keys, and third-party API secrets.',
    defensiveCheck:
      'Request /.env or /.git/HEAD and verify whether the response status is 200 with plaintext configuration keys.',
    remediationPattern:
      'Configure the web server (Nginx/Apache) to deny all access to hidden dotfiles: location ~ /\\. { deny all; return 404; }',
    references: [
      'https://cwe.mitre.org/data/definitions/552.html',
    ],
  },
  {
    id: 'ADV-SWAGGER-DOCS',
    title: 'Unauthenticated Interactive API Documentation Exposure',
    cweId: 'CWE-200',
    owaspCategory: 'A05:2021-Security Misconfiguration',
    severity: 'low',
    affectedTechnologies: ['Swagger UI', 'OpenAPI', 'FastAPI', 'Springfox'],
    description:
      'Publicly accessible interactive API testing suites (Swagger UI, Redoc) disclose API endpoints, expected request schemas, and internal documentation.',
    defensiveCheck:
      'Verify if /swagger-ui.html or /api-docs is publicly reachable without authentication.',
    remediationPattern:
      'Restrict API documentation endpoints behind corporate VPN or authenticate via SSO middleware before granting access to documentation UI.',
    references: [
      'https://cwe.mitre.org/data/definitions/200.html',
    ],
  },
  {
    id: 'ADV-CLOUD-BUCKET-EXPOSURE',
    title: 'Cloud Storage Bucket Authorization Policy Misconfiguration',
    cweId: 'CWE-732',
    owaspCategory: 'A01:2021-Broken Access Control',
    severity: 'high',
    affectedTechnologies: ['AWS S3', 'Google Cloud Storage', 'Azure Blob'],
    description:
      'Direct storage bucket URLs exhibiting 403 or 200 responses may indicate publicly discoverable asset storage or weak object ACL policies.',
    defensiveCheck:
      'Verify bucket ACL permissions and evaluate whether unauthenticated read/write/list operations are prohibited.',
    remediationPattern:
      'Enable AWS S3 "Block Public Access" at the bucket and account level. Enforce IAM roles and pre-signed URLs with short lifespans for object retrieval.',
    references: [
      'https://cwe.mitre.org/data/definitions/732.html',
    ],
  },
];
