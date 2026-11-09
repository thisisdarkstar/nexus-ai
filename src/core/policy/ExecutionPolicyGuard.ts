import { ScopeEvaluator } from '../../domain/assessment/ScopeEvaluator';
import type { ScopeItem } from '../../types';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';

export interface ExecutionRequest {
  id: string;
  url: string;
  method: HttpMethod;
  headers?: Record<string, string>;
  body?: string;
  isMutatingApproved?: boolean;
  initiator?: string;
}

export interface ExecutionValidationResult {
  allowed: boolean;
  reason: string;
  rejectionCode?:
    | 'OUT_OF_SCOPE'
    | 'BLOCKED_HOST'
    | 'UNSUPPORTED_SCHEME'
    | 'BUDGET_EXCEEDED'
    | 'RATE_LIMITED'
    | 'MUTATION_UNAPPROVED';
  normalizedUrl?: string;
}

export interface ExecutionAuditLog {
  id: string;
  timestamp: number;
  url: string;
  method: string;
  allowed: boolean;
  reason: string;
  initiator: string;
  rejectionCode?: string;
  timingMs?: number;
  responseStatus?: number;
  responseSize?: number;
}

export interface ExecutionPolicyConfig {
  maxRequestsPerSecondPerDomain: number;
  maxSessionRequestBudget: number;
  allowLocalhostFixtures: boolean;
  enforceApprovalForMutating: boolean;
}

export const DEFAULT_POLICY_CONFIG: ExecutionPolicyConfig = {
  maxRequestsPerSecondPerDomain: 5,
  maxSessionRequestBudget: 500,
  allowLocalhostFixtures: false,
  enforceApprovalForMutating: true,
};

export class ExecutionPolicyGuard {
  private static instance: ExecutionPolicyGuard;
  private config: ExecutionPolicyConfig;
  private auditLogs: ExecutionAuditLog[] = [];
  private domainTimestamps: Map<string, number[]> = new Map();
  private totalExecutedRequests: number = 0;

  private constructor(config: Partial<ExecutionPolicyConfig> = {}) {
    this.config = { ...DEFAULT_POLICY_CONFIG, ...config };
  }

  public static getInstance(config?: Partial<ExecutionPolicyConfig>): ExecutionPolicyGuard {
    if (!ExecutionPolicyGuard.instance) {
      ExecutionPolicyGuard.instance = new ExecutionPolicyGuard(config);
    } else if (config) {
      ExecutionPolicyGuard.instance.updateConfig(config);
    }
    return ExecutionPolicyGuard.instance;
  }

  public updateConfig(patch: Partial<ExecutionPolicyConfig>): void {
    this.config = { ...this.config, ...patch };
  }

  public getConfig(): ExecutionPolicyConfig {
    return { ...this.config };
  }

  public resetSessionBudget(): void {
    this.totalExecutedRequests = 0;
    this.domainTimestamps.clear();
  }

  public getAuditLogs(): ExecutionAuditLog[] {
    return [...this.auditLogs];
  }

  public clearAuditLogs(): void {
    this.auditLogs = [];
  }

  /**
   * Evaluates if a hostname or IP represents a forbidden private/internal target
   * to protect against client-side SSRF and unconstrained local network probes.
   */
  public isForbiddenInternalHost(hostname: string): boolean {
    const cleanHost = hostname.toLowerCase().trim().replace(/^\[|\]$/g, '');

    // 1. Direct Localhost and loopbacks
    if (
      cleanHost === 'localhost' ||
      cleanHost === '127.0.0.1' ||
      cleanHost === '::1' ||
      cleanHost === '0.0.0.0'
    ) {
      return true;
    }

    // 2. Cloud metadata IPs & DNS names (AWS, GCP, Azure, Alibaba)
    if (
      cleanHost === '169.254.169.254' ||
      cleanHost === 'metadata.google.internal' ||
      cleanHost === '100.100.100.200' ||
      cleanHost === '168.63.129.16'
    ) {
      return true;
    }

    // 3. Decimal, hex, or octal IPv4 loopback evasions (e.g. 2130706433, 0x7f000001)
    if (/^(0x[0-9a-f]+|\d+)$/i.test(cleanHost)) {
      try {
        const num = cleanHost.startsWith('0x') ? parseInt(cleanHost, 16) : parseInt(cleanHost, 10);
        const b1 = (num >>> 24) & 255;
        // 127.0.0.0/8 loopback block
        if (b1 === 127 || num === 0) return true;
        // 169.254.0.0/16 metadata block
        const b2 = (num >>> 16) & 255;
        if (b1 === 169 && b2 === 254) return true;
      } catch {
        // continue
      }
    }

    // 4. Wildcard DNS loopback services (nip.io, sslip.io, localtest.me)
    if (
      cleanHost.endsWith('.nip.io') ||
      cleanHost.endsWith('.sslip.io') ||
      cleanHost.endsWith('.localtest.me')
    ) {
      if (cleanHost.includes('127.0.0.1') || cleanHost.includes('169.254.169.254')) {
        return true;
      }
    }

    return false;
  }

  /**
   * Validates an execution request against engagement scope, safety policies,
   * rate limits, request budgets, and mutating approval status.
   */
  public validateRequest(
    request: ExecutionRequest,
    scopeRules: ScopeItem[] = []
  ): ExecutionValidationResult {
    let urlObj: URL;
    try {
      urlObj = new URL(request.url);
    } catch {
      return this.reject(request, 'Malformed request URL', 'UNSUPPORTED_SCHEME');
    }

    // 1. Scheme Check
    if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
      return this.reject(
        request,
        `Scheme '${urlObj.protocol}' is forbidden. Sanctioned schemes are http: and https: only.`,
        'UNSUPPORTED_SCHEME'
      );
    }

    // 2. Private loopback & cloud metadata checks
    if (!this.config.allowLocalhostFixtures && this.isForbiddenInternalHost(urlObj.hostname)) {
      return this.reject(
        request,
        `Host '${urlObj.hostname}' is a protected loopback or cloud metadata endpoint. Request blocked by defensive policy.`,
        'BLOCKED_HOST'
      );
    }

    // 3. Scope Boundary Enforcement
    if (scopeRules.length > 0) {
      const scopeCheck = ScopeEvaluator.isTargetInScope(request.url, scopeRules);
      if (!scopeCheck.inScope) {
        return this.reject(
          request,
          `Target '${urlObj.hostname}' is out of scope. ${scopeCheck.reason}`,
          'OUT_OF_SCOPE'
        );
      }
    }

    // 4. Session Request Budget Enforcement
    if (this.totalExecutedRequests >= this.config.maxSessionRequestBudget) {
      return this.reject(
        request,
        `Session request budget of ${this.config.maxSessionRequestBudget} requests exceeded. Execution halted to prevent unintended load.`,
        'BUDGET_EXCEEDED'
      );
    }

    // 5. Token-Bucket Rate Limiter per Domain (e.g. 5 req/sec)
    const domain = urlObj.hostname.toLowerCase();
    const now = Date.now();
    const windowStart = now - 1000;
    const timestamps = this.domainTimestamps.get(domain) || [];
    const recentTimestamps = timestamps.filter((t) => t >= windowStart);

    if (recentTimestamps.length >= this.config.maxRequestsPerSecondPerDomain) {
      return this.reject(
        request,
        `Rate limit exceeded for domain '${domain}' (${this.config.maxRequestsPerSecondPerDomain} req/s). Slow down dispatch.`,
        'RATE_LIMITED'
      );
    }

    // 6. Mutating Operation Checkpoint (POST, PUT, DELETE, PATCH)
    const isMutating = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method);
    if (isMutating && this.config.enforceApprovalForMutating && !request.isMutatingApproved) {
      return this.reject(
        request,
        `Mutating operation [${request.method}] requires explicit researcher authorization approval.`,
        'MUTATION_UNAPPROVED'
      );
    }

    // Request is authorized under policy
    return {
      allowed: true,
      reason: 'Request complies with engagement scope, authorization, rate limits, and safety boundaries.',
      normalizedUrl: urlObj.toString(),
    };
  }

  /**
   * Records an approved or rejected execution in the immutable audit trail.
   */
  public recordExecution(
    request: ExecutionRequest,
    validation: ExecutionValidationResult,
    result?: { timingMs?: number; responseStatus?: number; responseSize?: number }
  ): ExecutionAuditLog {
    const log: ExecutionAuditLog = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: Date.now(),
      url: request.url,
      method: request.method,
      allowed: validation.allowed,
      reason: validation.reason,
      initiator: request.initiator || 'researcher_ui',
      rejectionCode: validation.rejectionCode,
      timingMs: result?.timingMs,
      responseStatus: result?.responseStatus,
      responseSize: result?.responseSize,
    };

    this.auditLogs.unshift(log);

    // Keep logs bounded to last 1,000 entries
    if (this.auditLogs.length > 1000) {
      this.auditLogs.length = 1000;
    }

    if (validation.allowed) {
      this.totalExecutedRequests++;
      try {
        const u = new URL(request.url);
        const domain = u.hostname.toLowerCase();
        const existing = this.domainTimestamps.get(domain) || [];
        existing.push(Date.now());
        this.domainTimestamps.set(domain, existing);
      } catch {
        // ignore
      }
    }

    return log;
  }

  private reject(
    request: ExecutionRequest,
    reason: string,
    rejectionCode: ExecutionValidationResult['rejectionCode']
  ): ExecutionValidationResult {
    const result: ExecutionValidationResult = {
      allowed: false,
      reason,
      rejectionCode,
    };
    this.recordExecution(request, result);
    return result;
  }
}

export const executionPolicyGuard = ExecutionPolicyGuard.getInstance();
