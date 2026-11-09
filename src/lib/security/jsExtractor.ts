import type { ReconAsset, VulnerabilityFinding } from '../../types';

export interface ExtractedSecret {
  id: string;
  type: string;
  name: string;
  severity: VulnerabilityFinding['severity'];
  value: string;
  preview: string;
  line: number;
  description: string;
  cwe: string;
}

export interface ExtractedEndpoint {
  id: string;
  url: string;
  path: string;
  method: string;
  isRelative: boolean;
  riskScore: ReconAsset['riskScore'];
  flags: string[];
}

export interface JsExtractionResult {
  secrets: ExtractedSecret[];
  endpoints: ExtractedEndpoint[];
  domains: string[];
}

interface SecretRule {
  name: string;
  type: string;
  cwe: string;
  severity: VulnerabilityFinding['severity'];
  pattern: RegExp;
  description: string;
}

const SECRET_RULES: SecretRule[] = [
  {
    name: 'AWS Access Key ID',
    type: 'aws_key',
    cwe: 'CWE-798',
    severity: 'critical',
    pattern: /\b(AKIA[0-9A-Z]{16})\b/g,
    description: 'Exposed Amazon Web Services programmatic access key identifier.',
  },
  {
    name: 'Google / Firebase API Key',
    type: 'google_api_key',
    cwe: 'CWE-798',
    severity: 'high',
    pattern: /\b(AIza[0-9A-Za-z\-_]{35})\b/g,
    description: 'Exposed Google Cloud or Firebase client API key.',
  },
  {
    name: 'GitHub Personal Access Token',
    type: 'github_token',
    cwe: 'CWE-798',
    severity: 'critical',
    pattern: /\b(ghp_[a-zA-Z0-9]{36}|github_pat_[a-zA-Z0-9_]{82})\b/g,
    description: 'Leaked GitHub developer access token granting repo or organization access.',
  },
  {
    name: 'Slack Incoming Webhook',
    type: 'slack_webhook',
    cwe: 'CWE-798',
    severity: 'high',
    pattern: /(https:\/\/hooks\.slack\.com\/services\/T[a-zA-Z0-9_]+\/B[a-zA-Z0-9_]+\/[a-zA-Z0-9_]+)/g,
    description: 'Exposed Slack incoming webhook permitting unauthenticated notification injection.',
  },
  {
    name: 'Stripe Live Secret Key',
    type: 'stripe_secret_key',
    cwe: 'CWE-798',
    severity: 'critical',
    pattern: /\b(sk_SAMPLE_[0-9a-zA-Z]{24,34})\b/g,
    description: 'Exposed Stripe payment gateway live secret key granting full merchant API control.',
  },
  {
    name: 'Stripe Test Secret Key',
    type: 'stripe_test_key',
    cwe: 'CWE-798',
    severity: 'medium',
    pattern: /\b(sk_test_[0-9a-zA-Z]{24,34})\b/g,
    description: 'Exposed Stripe test secret key.',
  },
  {
    name: 'Hardcoded JSON Web Token (JWT)',
    type: 'jwt_token',
    cwe: 'CWE-798',
    severity: 'high',
    pattern: /\b(eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,})\b/g,
    description: 'Hardcoded JWT authorization token embedded inside client JavaScript bundle.',
  },
  {
    name: 'RSA / EC Private Key',
    type: 'private_key',
    cwe: 'CWE-312',
    severity: 'critical',
    pattern: /(-----BEGIN (?:RSA |EC )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC )?PRIVATE KEY-----)/g,
    description: 'Unencrypted asymmetric private cryptographic key embedded in source code.',
  },
  {
    name: 'Generic API Secret Key Variable',
    type: 'api_secret_var',
    cwe: 'CWE-798',
    severity: 'high',
    pattern: /(?:api_?key|apiKey|secret_?key|secretKey|client_?secret|auth_?token|access_?token)\s*[:=]\s*["']([a-zA-Z0-9_\-.~+=/]{20,80})["']/gi,
    description: 'Variable holding hardcoded authentication secret or bearer credential.',
  },
  {
    name: 'Bearer Token Literal',
    type: 'bearer_token',
    cwe: 'CWE-798',
    severity: 'high',
    pattern: /["']Bearer\s+([a-zA-Z0-9_\-\.]{25,120})["']/g,
    description: 'Hardcoded Authorization: Bearer token header literal in API request call.',
  },
];

/**
 * Extract sensitive secrets, API keys, and endpoints from JavaScript source
 */
export function extractFromJavaScript(
  jsCode: string,
  baseDomain: string = 'acmefinance.com'
): JsExtractionResult {
  const lines = jsCode.split('\n');
  const secrets: ExtractedSecret[] = [];
  const secretValueSet = new Set<string>();

  // 1. Secrets Extraction
  SECRET_RULES.forEach((rule) => {
    let match: RegExpExecArray | null;
    const regex = new RegExp(rule.pattern.source, rule.pattern.flags);

    while ((match = regex.exec(jsCode)) !== null) {
      const fullMatch = match[1] || match[0];
      if (!fullMatch || secretValueSet.has(fullMatch)) continue;
      secretValueSet.add(fullMatch);

      // Find approximate line number
      const matchIndex = match.index;
      let charCount = 0;
      let lineNum = 1;
      for (let i = 0; i < lines.length; i++) {
        charCount += lines[i].length + 1;
        if (charCount >= matchIndex) {
          lineNum = i + 1;
          break;
        }
      }

      // Truncate preview
      const preview =
        fullMatch.length > 36
          ? `${fullMatch.substring(0, 16)}...${fullMatch.substring(fullMatch.length - 12)}`
          : fullMatch;

      secrets.push({
        id: `secret-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        type: rule.type,
        name: rule.name,
        severity: rule.severity,
        value: fullMatch,
        preview,
        line: lineNum,
        description: rule.description,
        cwe: rule.cwe,
      });
    }
  });

  // 2. Relative API Endpoints Extraction
  // Matches quoted strings that look like API routes: "/api/v1/user", "/v2/auth/login", "/actuator/env", etc.
  const endpointRegex = /["'](\/(?:api|v[0-9]+|graphql|graphiql|auth|admin|user|users|account|accounts|internal|debug|actuator|rest|v1|v2|v3|webhooks?|oauth|export|download|upload|search)[a-zA-Z0-9_\-./?=&%#]*)["']/g;
  const endpointSet = new Set<string>();
  const endpoints: ExtractedEndpoint[] = [];

  let epMatch: RegExpExecArray | null;
  while ((epMatch = endpointRegex.exec(jsCode)) !== null) {
    const rawPath = epMatch[1];
    if (
      !rawPath ||
      rawPath.length < 4 ||
      rawPath.includes(' ') ||
      rawPath.endsWith('.js') ||
      rawPath.endsWith('.css') ||
      rawPath.endsWith('.png') ||
      rawPath.endsWith('.svg') ||
      endpointSet.has(rawPath)
    ) {
      continue;
    }
    endpointSet.add(rawPath);

    // Assess risk score & flags
    const flags: string[] = [];
    let riskScore: ReconAsset['riskScore'] = 'info';

    const lower = rawPath.toLowerCase();
    if (lower.includes('actuator') || lower.includes('debug') || lower.includes('.env')) {
      flags.push('Internal / Debug Exposure');
      riskScore = 'critical';
    } else if (lower.includes('admin') || lower.includes('cpanel')) {
      flags.push('Admin Portal Route');
      riskScore = 'high';
    } else if (lower.includes('url=') || lower.includes('dest=') || lower.includes('webhook=')) {
      flags.push('SSRF Parameter');
      riskScore = 'high';
    } else if (lower.includes('id=') || lower.includes('user_id=') || lower.includes('account_id=')) {
      flags.push('IDOR / BOLA Parameter');
      riskScore = 'medium';
    } else if (lower.includes('graphql') || lower.includes('graphiql')) {
      flags.push('GraphQL Endpoint');
      riskScore = 'medium';
    } else if (lower.includes('oauth') || lower.includes('token') || lower.includes('auth')) {
      flags.push('Authentication Route');
      riskScore = 'medium';
    }

    // Guess method from route prefix or naming
    let method = 'GET';
    if (lower.includes('create') || lower.includes('add') || lower.includes('upload') || lower.includes('login')) {
      method = 'POST';
    } else if (lower.includes('update') || lower.includes('edit')) {
      method = 'PUT';
    } else if (lower.includes('delete') || lower.includes('remove')) {
      method = 'DELETE';
    }

    endpoints.push({
      id: `ep-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      url: `https://${baseDomain}${rawPath}`,
      path: rawPath,
      method,
      isRelative: true,
      riskScore,
      flags,
    });
  }

  // 3. Absolute URLs & Hostnames Extraction
  const urlRegex = /https?:\/\/([a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(?::[0-9]+)?(?:[a-zA-Z0-9_\-./?=&%#]*)?)/g;
  let urlMatch: RegExpExecArray | null;
  const domainSet = new Set<string>();

  while ((urlMatch = urlRegex.exec(jsCode)) !== null) {
    const fullUrl = urlMatch[0];
    try {
      const parsed = new URL(fullUrl);
      const host = parsed.hostname;
      if (host && !host.includes('localhost') && !host.includes('127.0.0.1')) {
        domainSet.add(host);
      }

      // If it looks like an API or has query parameters, consider as endpoint
      if (
        (parsed.pathname.length > 1 || parsed.search.length > 0) &&
        !endpointSet.has(fullUrl) &&
        !fullUrl.endsWith('.js') &&
        !fullUrl.endsWith('.css')
      ) {
        endpointSet.add(fullUrl);
        const flags: string[] = [];
        let riskScore: ReconAsset['riskScore'] = 'info';

        if (host.includes('s3.amazonaws.com') || host.includes('blob.core.windows.net')) {
          flags.push('Cloud Storage Bucket');
          riskScore = 'high';
        } else if (fullUrl.includes('internal') || host.includes('dev') || host.includes('staging')) {
          flags.push('Internal / Staging Subdomain');
          riskScore = 'high';
        } else if (parsed.search.includes('url=') || parsed.search.includes('dest=')) {
          flags.push('SSRF Parameter');
          riskScore = 'high';
        } else if (parsed.search.includes('id=') || parsed.search.includes('user=')) {
          flags.push('IDOR Parameter');
          riskScore = 'medium';
        }

        endpoints.push({
          id: `ep-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          url: fullUrl,
          path: parsed.pathname + parsed.search,
          method: 'GET',
          isRelative: false,
          riskScore,
          flags,
        });
      }
    } catch {
      // Invalid URL syntax
    }
  }

  return {
    secrets,
    endpoints: endpoints.slice(0, 150),
    domains: Array.from(domainSet).sort(),
  };
}

/**
 * Realistic production minified JavaScript sample simulating a modern React/Webpack bundle
 * containing bug bounty gold: leaked Stripe keys, AWS bucket, staging OAuth endpoints, and internal APIs.
 */
export const SAMPLE_JS_BUNDLE = `/**
 * Acme Financial Portal - Webpack Production Bundle v4.18.2
 * Built at: 2026-10-14T08:12:00Z
 * (c) 2026 Acme Financial Services Corp. All rights reserved.
 */
!function(e){function r(r){for(var n,a,i=r[0],c=r[1],l=r[2],p=0,s=[];p<i.length;p++)a=i[p],Object.prototype.hasOwnProperty.call(o,a)&&o[a]&&s.push(o[a][0]),o[a]=0;for(n in c)Object.prototype.hasOwnProperty.call(c,n)&&(e[n]=c[n]);for(f&&f(r);s.length;)s.shift()();return u.push.apply(u,l||[]),t()}var t=function(){};

// API Configuration & Gateway Definitions
window.__CONFIG__ = {
  ENVIRONMENT: "staging",
  API_BASE_URL: "https://staging-api.acmefinance.com",
  INTERNAL_GATEWAY: "https://gateway.internal.acmefinance.com/v1",
  S3_ASSETS_BUCKET: "https://acme-finance-confidential-receipts.s3.amazonaws.com/",
  OAUTH_AUTHORIZE_ENDPOINT: "/oauth/v2/authorize?client_id=web_client_9918&redirect_uri=https://staging.acmefinance.com/auth/callback",
  SSRF_PREVIEW_SERVICE: "/api/v2/documents/preview?url=http://127.0.0.1:9090/health",
  ADMIN_METRICS_PATH: "/actuator/env",
  DOCS_SWAGGER: "/swagger-ui.html",
  GRAPHQL_ENDPOINT: "/graphql"
};

// Payment Gateway Controller & Secrets
const paymentConfig = {
  stripePublishableKey: "pk_SAMPLE_51M0XYZ9827361524354231",
  stripeSecretKey: "sk_SAMPLE_51M0XYZ982736152435423199ABCEFG", // CRITICAL LEAK
  googleMapsApiKey: "AIzaSyDEMO_8492049182309128309182390123849", // HIGH LEAK
  slackNotificationWebhook: "https://hooks.slack.com/services/DEMO0000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX",
  jwtServiceToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZG1pbi1zZXJ2aWNlIiwicm9sZXMiOlsic3VwZXJhZG1pbiJdfQ.7Y8Z9aBcDeFgHiJkLmNoPqRsTuVwXyZ"
};

// Endpoints for Banking & Identity Actions
export const API_ROUTES = {
  getUserProfile: (userId) => "/api/v1/users/profile?user_id=" + userId,
  transferFunds: "/api/v2/transfers/execute",
  exportAuditLog: (dest) => "/api/v2/admin/export?destination=" + encodeURIComponent(dest),
  debugHealth: "/debug/vars",
  webhookCallback: "/api/webhooks/incoming_payment"
};
`;

