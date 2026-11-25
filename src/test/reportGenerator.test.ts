import { describe, it, expect } from 'vitest';
import { generateHTMLReport, SAMPLE_VAPT_REPORT } from '../lib/security/reportGenerator';

describe('generateHTMLReport dark PDF styling', () => {
  it('uses dark canvas variables and enforces dark backgrounds in @media print', () => {
    const html = generateHTMLReport(SAMPLE_VAPT_REPORT);

    expect(html).toContain('color-scheme: dark;');
    expect(html).toContain('--bg-page: #020617;');
    expect(html).toContain('--bg-card: #090d16;');
    expect(html).toContain('print-color-adjust: exact !important;');
    expect(html).toContain('background: #020617 !important;');
    expect(html).not.toContain('body { background: #ffffff;');
  });

  it('supports optional light paper theme and prevents ID wrapping in summary table', () => {
    const html = generateHTMLReport(SAMPLE_VAPT_REPORT, 'light');

    expect(html).toContain('color-scheme: light;');
    expect(html).toContain('--bg-page: #f8fafc;');
    expect(html).toContain('--bg-card: #ffffff;');
    expect(html).toContain('white-space: nowrap;');
  });
});
