import { describe, it, expect } from 'vitest';
import { calculateCVSS31 } from '../lib/security/cvss';

describe('CVSS v3.1 Calculator', () => {
  it('calculates maximum 10.0 score for Critical Remote Unauthenticated Code Execution', () => {
    // CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:H -> 10.0 Critical
    const result = calculateCVSS31({
      version: '3.1',
      av: 'N',
      ac: 'L',
      pr: 'N',
      ui: 'N',
      s: 'C',
      c: 'H',
      i: 'H',
      a: 'H',
    });

    expect(result.score).toBe(10.0);
    expect(result.severity).toBe('critical');
    expect(result.vectorString).toBe('CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:H');
  });

  it('calculates standard 9.8 score for Scope Unchanged Critical Vulnerability', () => {
    // CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H -> 9.8 Critical
    const result = calculateCVSS31({
      version: '3.1',
      av: 'N',
      ac: 'L',
      pr: 'N',
      ui: 'N',
      s: 'U',
      c: 'H',
      i: 'H',
      a: 'H',
    });

    expect(result.score).toBe(9.8);
    expect(result.severity).toBe('critical');
    expect(result.vectorString).toBe('CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H');
  });

  it('calculates medium severity score for Reflected XSS with user interaction', () => {
    // CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:C/C:L/I:L/A:N -> 6.1 Medium
    const result = calculateCVSS31({
      version: '3.1',
      av: 'N',
      ac: 'L',
      pr: 'N',
      ui: 'R',
      s: 'C',
      c: 'L',
      i: 'L',
      a: 'N',
    });

    expect(result.score).toBe(6.1);
    expect(result.severity).toBe('medium');
  });

  it('returns 0.0 Info when all impact metrics are None', () => {
    const result = calculateCVSS31({
      version: '3.1',
      av: 'N',
      ac: 'L',
      pr: 'N',
      ui: 'N',
      s: 'U',
      c: 'N',
      i: 'N',
      a: 'N',
    });

    expect(result.score).toBe(0.0);
    expect(result.severity).toBe('info');
  });
});

