import { describe, it, expect, beforeEach } from 'vitest';
import {
  ExecutionPolicyGuard,
  type ExecutionRequest,
} from '../core/policy/ExecutionPolicyGuard';
import type { ScopeItem } from '../types';

describe('ExecutionPolicyGuard (P0 Security Boundary)', () => {
  let guard: ExecutionPolicyGuard;

  const testScope: ScopeItem[] = [
    {
      id: 'scp-1',
      target: '*.acme.corp',
      type: 'domain',
      inScope: true,
      status: 'in_progress',
    },
    {
      id: 'scp-2',
      target: 'forbidden.acme.corp',
      type: 'domain',
      inScope: false,
      status: 'verified_clean',
    },
  ];

  beforeEach(() => {
    guard = ExecutionPolicyGuard.getInstance({
      maxRequestsPerSecondPerDomain: 5,
      maxSessionRequestBudget: 20,
      allowLocalhostFixtures: false,
      enforceApprovalForMutating: true,
    });
    guard.resetSessionBudget();
    guard.clearAuditLogs();
  });

  it('allows valid in-scope GET requests against authorized targets', () => {
    const req: ExecutionRequest = {
      id: 'req-1',
      url: 'https://api.acme.corp/v1/users',
      method: 'GET',
    };

    const res = guard.validateRequest(req, testScope);
    expect(res.allowed).toBe(true);
    expect(res.rejectionCode).toBeUndefined();
  });

  it('rejects targets that violate engagement scope boundaries', () => {
    const reqOut: ExecutionRequest = {
      id: 'req-2',
      url: 'https://attacker-controlled.com/api',
      method: 'GET',
    };

    const resOut = guard.validateRequest(reqOut, testScope);
    expect(resOut.allowed).toBe(false);
    expect(resOut.rejectionCode).toBe('OUT_OF_SCOPE');

    // Blacklist override check
    const reqBlacklist: ExecutionRequest = {
      id: 'req-3',
      url: 'https://forbidden.acme.corp/secret',
      method: 'GET',
    };

    const resBlacklist = guard.validateRequest(reqBlacklist, testScope);
    expect(resBlacklist.allowed).toBe(false);
    expect(resBlacklist.rejectionCode).toBe('OUT_OF_SCOPE');
  });

  it('blocks loopback IP addresses, cloud metadata, and evasion schemes by default', () => {
    const blockedTargets = [
      'http://127.0.0.1/admin',
      'http://localhost:8080/metrics',
      'http://[::1]/debug',
      'http://169.254.169.254/latest/meta-data/',
      'http://metadata.google.internal/computeMetadata/v1/',
      'http://127.0.0.1.nip.io/',
      'http://2130706433/', // Decimal for 127.0.0.1
    ];

    for (const url of blockedTargets) {
      const req: ExecutionRequest = {
        id: `req-${url}`,
        url,
        method: 'GET',
      };
      const res = guard.validateRequest(req, []);
      expect(res.allowed).toBe(false);
      expect(res.rejectionCode).toBe('BLOCKED_HOST');
    }
  });

  it('rejects forbidden URI schemes (file, gopher, javascript)', () => {
    const badSchemes = [
      'file:///etc/passwd',
      'gopher://127.0.0.1:6379/_INFO',
      'javascript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
    ];

    for (const url of badSchemes) {
      const req: ExecutionRequest = {
        id: `req-${url}`,
        url,
        method: 'GET',
      };
      const res = guard.validateRequest(req, []);
      expect(res.allowed).toBe(false);
      expect(res.rejectionCode).toBe('UNSUPPORTED_SCHEME');
    }
  });

  it('enforces rate limits per domain when request velocity spikes', () => {
    const domainUrl = 'https://app.acme.corp/search';

    // Dispatch 5 allowed requests
    for (let i = 0; i < 5; i++) {
      const req: ExecutionRequest = {
        id: `burst-${i}`,
        url: domainUrl,
        method: 'GET',
      };
      const res = guard.validateRequest(req, testScope);
      expect(res.allowed).toBe(true);
      guard.recordExecution(req, res);
    }

    // 6th request within the same second must be rate-limited
    const reqBurst: ExecutionRequest = {
      id: 'burst-6',
      url: domainUrl,
      method: 'GET',
    };
    const resBurst = guard.validateRequest(reqBurst, testScope);
    expect(resBurst.allowed).toBe(false);
    expect(resBurst.rejectionCode).toBe('RATE_LIMITED');
  });

  it('enforces session budget ceilings to prevent runaway automation', () => {
    guard.updateConfig({ maxSessionRequestBudget: 3 });

    for (let i = 0; i < 3; i++) {
      const req: ExecutionRequest = {
        id: `budget-${i}`,
        url: `https://api.acme.corp/item/${i}`,
        method: 'GET',
      };
      const res = guard.validateRequest(req, testScope);
      expect(res.allowed).toBe(true);
      guard.recordExecution(req, res);
    }

    // 4th request exceeds session ceiling
    const reqOver: ExecutionRequest = {
      id: 'budget-over',
      url: 'https://api.acme.corp/item/99',
      method: 'GET',
    };
    const resOver = guard.validateRequest(reqOver, testScope);
    expect(resOver.allowed).toBe(false);
    expect(resOver.rejectionCode).toBe('BUDGET_EXCEEDED');
  });

  it('requires explicit researcher approval for mutating operations (POST/PUT/DELETE)', () => {
    const reqUnapproved: ExecutionRequest = {
      id: 'mut-1',
      url: 'https://api.acme.corp/users/delete',
      method: 'DELETE',
      isMutatingApproved: false,
    };

    const resUnapproved = guard.validateRequest(reqUnapproved, testScope);
    expect(resUnapproved.allowed).toBe(false);
    expect(resUnapproved.rejectionCode).toBe('MUTATION_UNAPPROVED');

    // With explicit researcher approval
    const reqApproved: ExecutionRequest = {
      id: 'mut-2',
      url: 'https://api.acme.corp/users/delete',
      method: 'DELETE',
      isMutatingApproved: true,
    };

    const resApproved = guard.validateRequest(reqApproved, testScope);
    expect(resApproved.allowed).toBe(true);
  });

  it('maintains an immutable audit trail of policy evaluations', () => {
    const req: ExecutionRequest = {
      id: 'audit-test-1',
      url: 'https://malicious.external/probe',
      method: 'GET',
    };

    guard.validateRequest(req, testScope);
    const logs = guard.getAuditLogs();

    expect(logs.length).toBeGreaterThanOrEqual(1);
    expect(logs[0].url).toBe('https://malicious.external/probe');
    expect(logs[0].allowed).toBe(false);
    expect(logs[0].rejectionCode).toBe('OUT_OF_SCOPE');
  });
});
