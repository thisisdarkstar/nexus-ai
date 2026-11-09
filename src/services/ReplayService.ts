import { executionPolicyGuard, type ExecutionRequest, type ExecutionValidationResult } from '../core/policy/ExecutionPolicyGuard';
import { evidenceVault } from '../domain/evidence/EvidenceVault';
import { storageManager } from '../core/storage/StorageManager';
import { eventBus } from '../core/bus/EventBus';
import type { ScopeItem } from '../types';

export interface ReplayDispatchResponse {
  success: boolean;
  status?: number;
  statusText?: string;
  headers?: Record<string, string>;
  body?: string;
  timingMs?: number;
  responseHash?: string;
  error?: string;
  validation: ExecutionValidationResult;
}

export class ReplayService {
  private static instance: ReplayService;

  private constructor() {}

  public static getInstance(): ReplayService {
    if (!ReplayService.instance) {
      ReplayService.instance = new ReplayService();
    }
    return ReplayService.instance;
  }

  /**
   * Safely dispatches an HTTP request through the strict Execution Policy Guard,
   * enforcing scope boundaries, rate limits, request budgets, and redirect safety.
   */
  public async dispatchAuthorizedRequest(
    request: ExecutionRequest,
    projectId: string = 'default',
    timeoutMs: number = 8000
  ): Promise<ReplayDispatchResponse> {
    // 1. Fetch current scope rules from active project
    let scopeRules: ScopeItem[] = [];
    try {
      scopeRules = await storageManager.getScope(projectId);
    } catch {
      // Fallback
    }

    // 2. Validate request against policy guard
    const validation = executionPolicyGuard.validateRequest(request, scopeRules);
    if (!validation.allowed) {
      return {
        success: false,
        error: `Policy Guard Rejection [${validation.rejectionCode}]: ${validation.reason}`,
        validation,
      };
    }

    // 3. Dispatch controlled fetch with timeout & manual redirect check
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const startTime = performance.now();

    try {
      const fetchHeaders: HeadersInit = { ...request.headers };
      const fetchOptions: RequestInit = {
        method: request.method,
        headers: fetchHeaders,
        signal: controller.signal,
        redirect: 'manual', // Enforces redirect destination inspection
      };

      if (['POST', 'PUT', 'PATCH'].includes(request.method) && request.body) {
        fetchOptions.body = request.body;
      }

      const response = await fetch(request.url, fetchOptions);
      clearTimeout(timer);
      const timingMs = Math.round(performance.now() - startTime);

      // Extract response headers
      const resHeaders: Record<string, string> = {};
      response.headers.forEach((val, key) => {
        resHeaders[key] = val;
      });

      // Redirect Re-Validation (SSRF escape prevention)
      if (response.status >= 300 && response.status < 400 && resHeaders['location']) {
        let redirectTarget = resHeaders['location'];
        if (!redirectTarget.includes('://')) {
          redirectTarget = new URL(redirectTarget, request.url).toString();
        }

        const redirectValidation = executionPolicyGuard.validateRequest(
          {
            ...request,
            url: redirectTarget,
            method: 'GET',
          },
          scopeRules
        );

        if (!redirectValidation.allowed) {
          executionPolicyGuard.recordExecution(request, {
            allowed: false,
            reason: `Redirect target '${redirectTarget}' violates scope or policy. Blocked.`,
            rejectionCode: redirectValidation.rejectionCode,
          });
          return {
            success: false,
            status: response.status,
            statusText: response.statusText,
            headers: resHeaders,
            error: `Redirect blocked by Policy Guard: Target '${redirectTarget}' is out of scope.`,
            validation: redirectValidation,
            timingMs,
          };
        }
      }

      const bodyText = await response.text();
      const responseHash = await evidenceVault.computeSha256(bodyText);

      // Record successful execution
      executionPolicyGuard.recordExecution(request, validation, {
        timingMs,
        responseStatus: response.status,
        responseSize: bodyText.length,
      });

      return {
        success: true,
        status: response.status,
        statusText: response.statusText,
        headers: resHeaders,
        body: bodyText,
        timingMs,
        responseHash,
        validation,
      };
    } catch (err: any) {
      clearTimeout(timer);
      const timingMs = Math.round(performance.now() - startTime);
      const errorMsg = err.name === 'AbortError' ? `Request timed out after ${timeoutMs}ms` : err.message || 'Network dispatch error';

      executionPolicyGuard.recordExecution(request, validation, {
        timingMs,
        responseStatus: 0,
      });

      return {
        success: false,
        error: errorMsg,
        validation,
        timingMs,
      };
    }
  }
}

export const replayService = ReplayService.getInstance();
