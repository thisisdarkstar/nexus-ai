import type { ScopeItem } from '../../types';

export interface ScopeEvaluationResult {
  inScope: boolean;
  matchedRule?: ScopeItem;
  reason: string;
}

/**
 * Checks whether an IPv4 address falls within a given CIDR block.
 */
function ipInCidr(ip: string, cidr: string): boolean {
  try {
    const [range, bitsStr] = cidr.split('/');
    const bits = bitsStr ? parseInt(bitsStr, 10) : 32;

    const ipToLong = (dot: string) =>
      dot.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;

    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
    return (ipToLong(ip) & mask) === (ipToLong(range) & mask);
  } catch {
    return false;
  }
}

/**
 * Checks if a hostname matches a wildcard domain pattern (e.g. *.example.com)
 */
function matchDomainWildcard(hostname: string, pattern: string): boolean {
  const cleanHost = hostname.toLowerCase().trim();
  const cleanPattern = pattern.toLowerCase().trim().replace(/^https?:\/\//, '').split('/')[0];

  // Exact match
  if (cleanHost === cleanPattern) return true;

  // Wildcard pattern: *.domain.com
  if (cleanPattern.startsWith('*.')) {
    const rootDomain = cleanPattern.slice(2);
    // Matches example.com (the apex itself)
    if (cleanHost === rootDomain) return true;
    // Matches sub.example.com or a.b.example.com
    if (cleanHost.endsWith('.' + rootDomain)) return true;
  }

  return false;
}

/**
 * Evaluates whether a target asset URL or Host complies with active Scope items.
 */
export class ScopeEvaluator {
  private scopeItems: ScopeItem[];

  constructor(scopeItems: ScopeItem[] = []) {
    this.scopeItems = scopeItems;
  }

  public setScopeItems(items: ScopeItem[]): void {
    this.scopeItems = items;
  }

  public evaluate(targetUrlOrHost: string): ScopeEvaluationResult {
    if (!this.scopeItems || this.scopeItems.length === 0) {
      return {
        inScope: true,
        reason: 'No scope boundaries configured (permissive default)',
      };
    }

    let hostname = targetUrlOrHost;
    let pathname = '/';
    try {
      if (targetUrlOrHost.includes('://')) {
        const u = new URL(targetUrlOrHost);
        hostname = u.hostname;
        pathname = u.pathname;
      } else {
        const parts = targetUrlOrHost.split('/');
        hostname = parts[0].split(':')[0];
        if (parts.length > 1) {
          pathname = '/' + parts.slice(1).join('/');
        }
      }
    } catch {
      hostname = targetUrlOrHost;
    }

    // 1. Check Out-of-Scope exclusion rules first (Blacklist overrides Whitelist)
    const outOfScopeItems = this.scopeItems.filter((s) => !s.inScope);
    for (const rule of outOfScopeItems) {
      if (this.matchesRule(hostname, pathname, rule)) {
        return {
          inScope: false,
          matchedRule: rule,
          reason: `Explicitly excluded by out-of-scope rule: ${rule.target}`,
        };
      }
    }

    // 2. Check In-Scope inclusion rules
    const inScopeItems = this.scopeItems.filter((s) => s.inScope);
    if (inScopeItems.length === 0) {
      return {
        inScope: true,
        reason: 'No explicit in-scope rules defined',
      };
    }

    for (const rule of inScopeItems) {
      if (this.matchesRule(hostname, pathname, rule)) {
        return {
          inScope: true,
          matchedRule: rule,
          reason: `Matched in-scope rule: ${rule.target}`,
        };
      }
    }

    return {
      inScope: false,
      reason: `Target ${hostname} does not match any configured in-scope boundaries`,
    };
  }

  private matchesRule(hostname: string, pathname: string, rule: ScopeItem): boolean {
    const rawTarget = rule.target.trim();

    if (rule.type === 'ip_range' || /^[0-9.]+(\/[0-9]+)?$/.test(rawTarget)) {
      if (rawTarget.includes('/')) {
        return ipInCidr(hostname, rawTarget);
      }
      return hostname === rawTarget;
    }

    if (rule.type === 'api' || rawTarget.startsWith('/')) {
      const cleanPrefix = rawTarget.replace(/\*$/, '');
      return pathname.startsWith(cleanPrefix);
    }

    // Domain wildcard matching
    return matchDomainWildcard(hostname, rawTarget);
  }
}
