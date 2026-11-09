import type { GraphNode } from '../graph/types';
import type { VulnerabilityFinding } from '../../types';

export interface PrioritizedItem {
  id: string;
  url: string;
  compositeScore: number; // 0 - 100
  priorityLevel: 'critical' | 'high' | 'medium' | 'low';
  rationales: string[];
  findingsCount: number;
  isOverridden?: boolean;
  overrideNotes?: string;
}

export class PrioritizationEngine {
  private static instance: PrioritizationEngine;

  private constructor() {}

  public static getInstance(): PrioritizationEngine {
    if (!PrioritizationEngine.instance) {
      PrioritizationEngine.instance = new PrioritizationEngine();
    }
    return PrioritizationEngine.instance;
  }

  /**
   * Computes an explainable priority score (0-100) for an endpoint or asset
   * by combining vulnerability findings, CISA KEV/exploit availability,
   * endpoint sensitivity, auth context, and engagement scope rules.
   */
  public prioritizeEndpoint(
    endpoint: GraphNode,
    findings: VulnerabilityFinding[] = []
  ): PrioritizedItem {
    let score = 0;
    const rationales: string[] = [];
    const urlLower = (endpoint.id.replace(/^ep:/, '') || endpoint.label).toLowerCase();

    // 0. Scope Rule Check: Out-of-scope items cannot be prioritized for active testing
    if (!endpoint.inScope) {
      return {
        id: endpoint.id,
        url: endpoint.label,
        compositeScore: 0,
        priorityLevel: 'low',
        rationales: ['Out of scope: Deprioritized by engagement boundaries (0 pts)'],
        findingsCount: findings.length,
      };
    }
    score += 10;
    rationales.push('Target In-Scope: Authorized engagement boundary (+10 pts)');

    // 1. Technical Vulnerabilities Attached (0 - 40 pts)
    const criticalFindings = findings.filter((f) => f.severity === 'critical');
    const highFindings = findings.filter((f) => f.severity === 'high');
    const mediumFindings = findings.filter((f) => f.severity === 'medium');

    if (criticalFindings.length > 0) {
      score += 40;
      rationales.push(`Critical Finding Associated: ${criticalFindings[0].title} (+40 pts)`);
    } else if (highFindings.length > 0) {
      score += 25;
      rationales.push(`High Severity Finding Associated: ${highFindings[0].title} (+25 pts)`);
    } else if (mediumFindings.length > 0) {
      score += 15;
      rationales.push(`Medium Finding Associated: ${mediumFindings[0].title} (+15 pts)`);
    }

    // 2. Actively Exploited Vulnerabilities / CISA KEV Match (0 - 20 pts)
    const hasKevMatch = findings.some(
      (f) =>
        f.cweId === 'CWE-22' || // Path Traversal / e.g. Apache 2.4.49
        f.cweId === 'CWE-78' || // Command Injection
        (f.description && f.description.toLowerCase().includes('actively exploited'))
    );
    if (hasKevMatch) {
      score += 20;
      rationales.push('CISA KEV / Actively Exploited Weakness Class (+20 pts)');
    }

    // 3. Endpoint Sensitivity & High-Risk Keywords (0 - 20 pts)
    const SENSITIVE_KEYWORDS = ['/admin', '/internal', '/debug', '/actuator', '/api/v1/auth', '/payment', '/checkout', '/config', '/env'];
    const matchedKeyword = SENSITIVE_KEYWORDS.find((kw) => urlLower.includes(kw));

    if (matchedKeyword) {
      score += 15;
      rationales.push(`Sensitive Endpoint Keyword '${matchedKeyword}' (+15 pts)`);
    }

    const BOLA_SSRF_PARAMS = ['redirect', 'url', 'dest', 'id', 'account', 'user', 'file', 'token'];
    const matchedParam = BOLA_SSRF_PARAMS.find((p) => urlLower.includes(`${p}=`));
    if (matchedParam) {
      score += 10;
      rationales.push(`High-Risk Parameter Vector '${matchedParam}=' (+10 pts)`);
    }

    // 4. Authentication Context (0 - 10 pts)
    if (endpoint.attributes?.statusCode === 200 && urlLower.includes('/actuator')) {
      score += 10;
      rationales.push('Unauthenticated Access Confirmed (HTTP 200) (+10 pts)');
    }

    // Cap at 100
    const compositeScore = Math.min(100, score);

    let priorityLevel: PrioritizedItem['priorityLevel'] = 'low';
    if (compositeScore >= 80) priorityLevel = 'critical';
    else if (compositeScore >= 60) priorityLevel = 'high';
    else if (compositeScore >= 35) priorityLevel = 'medium';

    return {
      id: endpoint.id,
      url: endpoint.label,
      compositeScore,
      priorityLevel,
      rationales,
      findingsCount: findings.length,
    };
  }
}

export const prioritizationEngine = PrioritizationEngine.getInstance();
