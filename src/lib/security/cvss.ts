import type { CVSSMetrics, VulnerabilitySeverity } from '../../types';

// CVSS v3.1 metric weightings
const WEIGHTS = {
  av: { N: 0.85, A: 0.62, L: 0.55, P: 0.2 },
  ac: { L: 0.77, H: 0.44 },
  pr: {
    U: { N: 0.85, L: 0.62, H: 0.27 }, // Scope Unchanged
    C: { N: 0.85, L: 0.68, H: 0.5 }, // Scope Changed
  },
  ui: { N: 0.85, R: 0.62 },
  c: { H: 0.56, L: 0.22, N: 0 },
  i: { H: 0.56, L: 0.22, N: 0 },
  a: { H: 0.56, L: 0.22, N: 0 },
};

function roundup(val: number): number {
  const precision = 100000;
  const rounded = Math.round(val * precision) / precision;
  const ceil = Math.ceil(rounded * 10) / 10;
  return Number(ceil.toFixed(1));
}

export function calculateCVSS31(metrics: Omit<CVSSMetrics, 'score' | 'severity' | 'vectorString'>): CVSSMetrics {
  const { av, ac, pr, ui, s, c, i, a } = metrics;

  const avWeight = WEIGHTS.av[av];
  const acWeight = WEIGHTS.ac[ac];
  const prWeight = WEIGHTS.pr[s][pr];
  const uiWeight = WEIGHTS.ui[ui];
  const cWeight = WEIGHTS.c[c];
  const iWeight = WEIGHTS.i[i];
  const aWeight = WEIGHTS.a[a];

  // Impact Sub-Score
  const iss = 1 - (1 - cWeight) * (1 - iWeight) * (1 - aWeight);

  let impact: number;
  if (s === 'U') {
    impact = 6.42 * iss;
  } else {
    impact = 7.52 * (iss - 0.029) - 3.25 * Math.pow(iss - 0.02, 15);
  }

  const exploitability = 8.22 * avWeight * acWeight * prWeight * uiWeight;

  let score = 0;
  if (impact > 0) {
    if (s === 'U') {
      score = roundup(Math.min(impact + exploitability, 10));
    } else {
      score = roundup(Math.min(1.08 * (impact + exploitability), 10));
    }
  }

  let severity: VulnerabilitySeverity = 'info';
  if (score >= 9.0) severity = 'critical';
  else if (score >= 7.0) severity = 'high';
  else if (score >= 4.0) severity = 'medium';
  else if (score >= 0.1) severity = 'low';

  const vectorString = `CVSS:3.1/AV:${av}/AC:${ac}/PR:${pr}/UI:${ui}/S:${s}/C:${c}/I:${i}/A:${a}`;

  return {
    version: '3.1',
    av,
    ac,
    pr,
    ui,
    s,
    c,
    i,
    a,
    score,
    severity,
    vectorString,
  };
}

export const DEFAULT_CVSS: CVSSMetrics = {
  version: '3.1',
  av: 'N',
  ac: 'L',
  pr: 'N',
  ui: 'N',
  s: 'U',
  c: 'H',
  i: 'H',
  a: 'H',
  score: 9.8,
  severity: 'critical',
  vectorString: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H',
};
