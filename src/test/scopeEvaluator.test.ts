import { describe, it, expect } from 'vitest';
import { ScopeEvaluator } from '../domain/assessment/ScopeEvaluator';
import type { ScopeItem } from '../types';

describe('ScopeEvaluator Service', () => {
  it('correctly matches wildcard domains and apex domains', () => {
    const scopeRules: ScopeItem[] = [
      {
        id: '1',
        target: '*.acmefinance.com',
        type: 'domain',
        inScope: true,
        status: 'untested',
      },
    ];

    const evaluator = new ScopeEvaluator(scopeRules);

    // Should match apex
    expect(evaluator.evaluate('https://acmefinance.com/dashboard').inScope).toBe(true);

    // Should match direct subdomain
    expect(evaluator.evaluate('https://api.acmefinance.com/v1').inScope).toBe(true);

    // Should match deep nested subdomain
    expect(evaluator.evaluate('https://dev.auth.acmefinance.com').inScope).toBe(true);

    // Should reject suffix squatting attacks
    expect(evaluator.evaluate('https://eviltargetacmefinance.com').inScope).toBe(false);
    expect(evaluator.evaluate('https://acmefinance.com.attacker.com').inScope).toBe(false);
  });

  it('respects Out-of-Scope exclusion overrides (Blacklist overrides Whitelist)', () => {
    const scopeRules: ScopeItem[] = [
      {
        id: '1',
        target: '*.acmefinance.com',
        type: 'domain',
        inScope: true,
        status: 'untested',
      },
      {
        id: '2',
        target: 'production-payments.acmefinance.com',
        type: 'domain',
        inScope: false, // Critical Out-of-Scope rule
        status: 'untested',
      },
    ];

    const evaluator = new ScopeEvaluator(scopeRules);

    // Allowed general subdomain
    expect(evaluator.evaluate('https://api.acmefinance.com').inScope).toBe(true);

    // Excluded critical payment gateway
    const result = evaluator.evaluate('https://production-payments.acmefinance.com/charge');
    expect(result.inScope).toBe(false);
    expect(result.reason).toContain('Explicitly excluded by out-of-scope rule');
  });

  it('evaluates CIDR IP blocks accurately', () => {
    const scopeRules: ScopeItem[] = [
      {
        id: '1',
        target: '10.50.0.0/16',
        type: 'ip_range',
        inScope: true,
        status: 'untested',
      },
      {
        id: '2',
        target: '10.50.99.0/24',
        type: 'ip_range',
        inScope: false,
        status: 'untested',
      },
    ];

    const evaluator = new ScopeEvaluator(scopeRules);

    // In 10.50.0.0/16
    expect(evaluator.evaluate('10.50.1.20').inScope).toBe(true);

    // In excluded 10.50.99.0/24
    expect(evaluator.evaluate('10.50.99.5').inScope).toBe(false);

    // Outside 10.50.0.0/16
    expect(evaluator.evaluate('10.51.0.1').inScope).toBe(false);
  });
});
