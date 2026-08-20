import type { VAPTReport, VulnerabilityFinding } from '../../types';

export function generateMarkdownReport(report: VAPTReport): string {
  const criticalCount = report.findings.filter((f) => f.severity === 'critical').length;
  const highCount = report.findings.filter((f) => f.severity === 'high').length;
  const mediumCount = report.findings.filter((f) => f.severity === 'medium').length;
  const lowCount = report.findings.filter((f) => f.severity === 'low').length;
  const infoCount = report.findings.filter((f) => f.severity === 'info').length;

  let md = `# ${report.title}
**Client:** ${report.clientName || 'Confidential Client'}  
**Assessment Type:** ${report.assessmentType.toUpperCase()} Penetration Test  
**Lead Tester:** ${report.leadTester || 'Nexus Security AI'}  
**Assessment Period:** ${report.startDate || 'N/A'} - ${report.endDate || 'N/A'}  
**Target Scope:** \`${report.targetScope || 'All In-Scope Assets'}\`  
**Report Date:** ${new Date(report.createdAt).toLocaleDateString()}  

---

## 1. Executive Summary
${report.executiveSummary || 'A comprehensive security assessment was conducted to evaluate the defensive posture and identify exploitable vulnerabilities within the target environment.'}

### Risk Overview & Findings Summary
| Severity | Count |
| :--- | :--- |
| 🔴 **Critical** | ${criticalCount} |
| 🟠 **High** | ${highCount} |
| 🟡 **Medium** | ${mediumCount} |
| 🔵 **Low** | ${lowCount} |
| ⚪ **Informational** | ${infoCount} |
| **Total Findings** | **${report.findings.length}** |

---

## 2. Assessment Methodology & Scope
${report.methodology || 'This assessment adhered to the OWASP Web Security Testing Guide (WSTG v4.2) and the NIST SP 800-115 technical assessment guidelines.'}

---

## 3. Detailed Technical Findings

`;

  report.findings.forEach((f, idx) => {
    md += `### ${idx + 1}. [${f.severity.toUpperCase()}] ${f.title}

- **Finding ID:** \`${f.id}\`
- **Severity:** **${f.severity.toUpperCase()}** ${f.cvss ? `(CVSS ${f.cvss.score} • \`${f.cvss.vectorString}\`)` : ''}
- **Vulnerability Classification:** ${f.cweId || 'N/A'} ${f.owaspCategory ? `• ${f.owaspCategory}` : ''}
- **Affected Asset/Endpoint:** \`${f.targetEndpoint || f.file || 'General Environment'}\`
- **Remediation Status:** \`${(f.status || 'open').toUpperCase()}\`

#### Vulnerability Description & Risk
${f.description}

`;

    if (f.pocSteps && f.pocSteps.length > 0) {
      md += `#### Steps to Reproduce (PoC)
${f.pocSteps.map((step, sIdx) => `${sIdx + 1}. ${step}`).join('\n')}

`;
    }

    md += `#### Remediation & Defensive Hardening
${f.remediation}

`;

    if (f.patchDiff) {
      md += `#### Suggested Remediation Patch (Diff)
\`\`\`diff
--- Original Insecure
+++ Patched Secure
${f.patchDiff.original.split('\n').map((l) => `- ${l}`).join('\n')}
${f.patchDiff.patched.split('\n').map((l) => `+ ${l}`).join('\n')}
\`\`\`

`;
    }

    if (f.references && f.references.length > 0) {
      md += `#### References
${f.references.map((r) => `- [${r}](${r})`).join('\n')}

`;
    }

    md += `---\n\n`;
  });

  md += `## 4. Conclusion & Strategic Next Steps
It is strongly advised to prioritize remediation for all **Critical** and **High** severity vulnerabilities immediately. Implement defense-in-depth access controls, automated SAST/DAST CI/CD verification, and re-test remediated endpoints before production deployment.
`;

  return md;
}

export function generateBugBountyMarkdown(finding: VulnerabilityFinding, target: string): string {
  return `## Vulnerability Title
${finding.title}

## Target Asset / Endpoint
\`${finding.targetEndpoint || target}\`

## Weakness Classification
- **CWE:** ${finding.cweId || 'CWE-200'}
- **OWASP:** ${finding.owaspCategory || 'OWASP Top 10'}
- **CVSS v3.1:** ${finding.cvss ? `${finding.cvss.score} (${finding.cvss.vectorString})` : 'N/A'}

## Summary
${finding.description}

## Steps to Reproduce
${finding.pocSteps && finding.pocSteps.length > 0 ? finding.pocSteps.map((s, i) => `${i + 1}. ${s}`).join('\n') : '1. Navigate to target endpoint.\n2. Supply test payload.\n3. Observe anomalous behavior.'}

## Business & Security Impact
An attacker exploiting this vulnerability could compromise user confidentiality, bypass access control boundaries, or manipulate sensitive application state.

## Recommended Fix
${finding.remediation}
`;
}

export function generateHTMLReport(report: VAPTReport): string {
  const criticalCount = report.findings.filter((f) => f.severity === 'critical').length;
  const highCount = report.findings.filter((f) => f.severity === 'high').length;
  const mediumCount = report.findings.filter((f) => f.severity === 'medium').length;
  const lowCount = report.findings.filter((f) => f.severity === 'low').length;
  const infoCount = report.findings.filter((f) => f.severity === 'info').length;

  const findingsHTML = report.findings
    .map(
      (f, idx) => `
    <div class="finding-card finding-${f.severity}">
      <div class="finding-card-header">
        <div class="finding-title-group">
          <span class="finding-number">#${idx + 1}</span>
          <h3 class="finding-title">${escapeHtml(f.title)}</h3>
        </div>
        <span class="severity-pill pill-${f.severity}">${f.severity.toUpperCase()}</span>
      </div>

      <div class="finding-meta-grid">
        <div class="meta-item">
          <span class="meta-label">Finding ID:</span>
          <span class="meta-value"><code>${escapeHtml(f.id)}</code></span>
        </div>
        <div class="meta-item">
          <span class="meta-label">Classification:</span>
          <span class="meta-value">${escapeHtml(f.cweId || 'CWE-N/A')} • ${escapeHtml(f.owaspCategory || 'OWASP')}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">Affected Target:</span>
          <span class="meta-value"><code>${escapeHtml(f.targetEndpoint || f.file || report.targetScope)}</code></span>
        </div>
        <div class="meta-item">
          <span class="meta-label">Remediation Status:</span>
          <span class="meta-value status-badge status-${f.status || 'open'}">${(f.status || 'OPEN').toUpperCase()}</span>
        </div>
      </div>

      ${
        f.cvss
          ? `
      <div class="cvss-banner cvss-${f.cvss.severity}">
        <div class="cvss-score-circle">
          <span class="cvss-score-num">${f.cvss.score}</span>
          <span class="cvss-score-label">${f.cvss.severity.toUpperCase()}</span>
        </div>
        <div class="cvss-vector-info">
          <span class="cvss-vtitle">CVSS v3.1 Base Metric Vector</span>
          <code class="cvss-vector-str">${escapeHtml(f.cvss.vectorString)}</code>
        </div>
      </div>
      `
          : ''
      }

      <div class="finding-section">
        <h4 class="section-subtitle">1. Vulnerability Description & Technical Exposure</h4>
        <p class="section-text">${escapeHtml(f.description)}</p>
      </div>

      ${
        f.pocSteps && f.pocSteps.length > 0
          ? `
      <div class="finding-section">
        <h4 class="section-subtitle">2. Steps to Reproduce (Proof of Concept)</h4>
        <ol class="poc-list">
          ${f.pocSteps.map((step) => `<li>${escapeHtml(step)}</li>`).join('')}
        </ol>
      </div>
      `
          : ''
      }

      <div class="finding-section">
        <h4 class="section-subtitle">3. Remediation & Defensive Hardening Guidance</h4>
        <p class="section-text">${escapeHtml(f.remediation)}</p>
      </div>

      ${
        f.patchDiff
          ? `
      <div class="finding-section">
        <h4 class="section-subtitle">4. Remediation Patch (Diff)</h4>
        <pre class="diff-block"><code class="diff-code">${escapeHtml(
          f.patchDiff.original
            .split('\n')
            .map((l) => `- ${l}`)
            .join('\n') +
            '\n' +
            f.patchDiff.patched
              .split('\n')
              .map((l) => `+ ${l}`)
              .join('\n')
        )}</code></pre>
      </div>
      `
          : ''
      }

      ${
        f.references && f.references.length > 0
          ? `
      <div class="finding-section">
        <h4 class="section-subtitle">5. References & Documentation</h4>
        <ul class="ref-list">
          ${f.references.map((r) => `<li><a href="${escapeHtml(r)}" target="_blank">${escapeHtml(r)}</a></li>`).join('')}
        </ul>
      </div>
      `
          : ''
      }
    </div>
  `
    )
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(report.title)} - Security Assessment Report</title>
  <style>
    :root {
      --primary: #0f172a;
      --accent: #059669;
      --accent-light: #10b981;
      --critical: #dc2626;
      --high: #ea580c;
      --medium: #d97706;
      --low: #2563eb;
      --info: #475569;
      --bg-page: #f8fafc;
      --bg-card: #ffffff;
      --border: #e2e8f0;
      --text: #1e293b;
      --text-muted: #64748b;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.6;
      color: var(--text);
      background: var(--bg-page);
      padding: 40px 20px;
      -webkit-font-smoothing: antialiased;
    }

    .report-wrapper {
      max-width: 960px;
      margin: 0 auto;
      background: var(--bg-card);
      border-radius: 12px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.06);
      border: 1px solid var(--border);
      overflow: hidden;
    }

    /* Top Action Bar */
    .top-action-bar {
      max-width: 960px;
      margin: 0 auto 16px auto;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .print-btn {
      background: linear-gradient(135deg, #059669, #10b981);
      color: #fff;
      border: none;
      padding: 10px 20px;
      border-radius: 8px;
      cursor: pointer;
      font-weight: 600;
      font-size: 0.9rem;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      box-shadow: 0 4px 12px rgba(16,185,129,0.3);
    }
    .print-btn:hover { background: #047857; }

    /* Cover / Header Banner */
    .report-header {
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
      color: #ffffff;
      padding: 48px;
      border-bottom: 4px solid var(--accent);
    }
    .report-brand {
      display: inline-block;
      font-size: 0.8rem;
      font-weight: 700;
      letter-spacing: 2px;
      text-transform: uppercase;
      color: var(--accent-light);
      margin-bottom: 8px;
    }
    .report-main-title {
      font-size: 2rem;
      font-weight: 800;
      color: #f8fafc;
      line-height: 1.25;
      margin-bottom: 16px;
    }
    .report-confidential-pill {
      display: inline-block;
      background: rgba(239,68,68,0.2);
      border: 1px solid rgba(239,68,68,0.4);
      color: #fca5a5;
      font-size: 0.75rem;
      font-weight: 700;
      padding: 3px 10px;
      border-radius: 9999px;
      letter-spacing: 1px;
      text-transform: uppercase;
    }

    /* Metadata Table */
    .metadata-strip {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
      padding: 24px 48px;
      background: #f1f5f9;
      border-bottom: 1px solid var(--border);
    }
    .meta-box { display: flex; flex-direction: column; gap: 4px; }
    .meta-box-label { font-size: 0.75rem; font-weight: 600; text-transform: uppercase; color: var(--text-muted); }
    .meta-box-val { font-size: 0.95rem; font-weight: 600; color: var(--primary); }

    .report-body { padding: 48px; }

    /* Headings */
    h2.section-header {
      font-size: 1.35rem;
      font-weight: 700;
      color: var(--primary);
      margin: 40px 0 16px 0;
      padding-bottom: 8px;
      border-bottom: 2px solid var(--border);
      display: flex;
      align-items: center;
      gap: 8px;
    }
    h2.section-header:first-of-type { margin-top: 0; }

    .lead-paragraph {
      font-size: 1rem;
      color: #334155;
      line-height: 1.7;
      margin-bottom: 24px;
    }

    /* Executive Risk Dashboard */
    .risk-dashboard {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
      gap: 12px;
      margin: 24px 0 32px 0;
    }
    .risk-card {
      background: #ffffff;
      border-radius: 8px;
      padding: 16px;
      text-align: center;
      border: 1px solid var(--border);
      box-shadow: 0 2px 6px rgba(0,0,0,0.03);
    }
    .risk-card-num { font-size: 2rem; font-weight: 800; line-height: 1; margin-bottom: 6px; }
    .risk-card-label { font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }

    .risk-critical { border-top: 4px solid var(--critical); }
    .risk-critical .risk-card-num { color: var(--critical); }
    .risk-critical .risk-card-label { color: var(--critical); }

    .risk-high { border-top: 4px solid var(--high); }
    .risk-high .risk-card-num { color: var(--high); }
    .risk-high .risk-card-label { color: var(--high); }

    .risk-medium { border-top: 4px solid var(--medium); }
    .risk-medium .risk-card-num { color: var(--medium); }
    .risk-medium .risk-card-label { color: var(--medium); }

    .risk-low { border-top: 4px solid var(--low); }
    .risk-low .risk-card-num { color: var(--low); }
    .risk-low .risk-card-label { color: var(--low); }

    .risk-info { border-top: 4px solid var(--info); }
    .risk-info .risk-card-num { color: var(--info); }
    .risk-info .risk-card-label { color: var(--info); }

    /* Summary Table */
    .table-responsive { width: 100%; overflow-x: auto; margin-bottom: 32px; }
    .summary-table { width: 100%; border-collapse: collapse; text-align: left; }
    .summary-table th { background: #f8fafc; color: var(--primary); font-weight: 700; font-size: 0.8rem; text-transform: uppercase; padding: 12px 16px; border-bottom: 2px solid var(--border); }
    .summary-table td { padding: 12px 16px; font-size: 0.88rem; border-bottom: 1px solid var(--border); color: #334155; }
    .summary-table tr:hover { background: #f8fafc; }

    /* Finding Cards */
    .finding-card {
      background: #ffffff;
      border: 1px solid var(--border);
      border-radius: 10px;
      margin-bottom: 32px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.03);
      overflow: hidden;
      page-break-inside: avoid;
    }
    .finding-critical { border-left: 6px solid var(--critical); }
    .finding-high { border-left: 6px solid var(--high); }
    .finding-medium { border-left: 6px solid var(--medium); }
    .finding-low { border-left: 6px solid var(--low); }
    .finding-info { border-left: 6px solid var(--info); }

    .finding-card-header {
      padding: 20px 24px;
      background: #f8fafc;
      border-bottom: 1px solid var(--border);
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }
    .finding-title-group { display: flex; align-items: center; gap: 10px; }
    .finding-number { font-size: 0.9rem; font-weight: 800; color: var(--text-muted); }
    .finding-title { font-size: 1.15rem; font-weight: 700; color: var(--primary); }

    .severity-pill {
      font-size: 0.75rem;
      font-weight: 800;
      padding: 4px 12px;
      border-radius: 9999px;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }
    .pill-critical { background: #fee2e2; color: #b91c1c; border: 1px solid #fca5a5; }
    .pill-high { background: #ffedd5; color: #c2410c; border: 1px solid #fdba74; }
    .pill-medium { background: #fef3c7; color: #b45309; border: 1px solid #fde68a; }
    .pill-low { background: #dbeafe; color: #1d4ed8; border: 1px solid #93c5fd; }
    .pill-info { background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; }

    .finding-meta-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 12px;
      padding: 16px 24px;
      background: #ffffff;
      border-bottom: 1px solid var(--border);
    }
    .meta-item { display: flex; flex-direction: column; gap: 2px; }
    .meta-label { font-size: 0.72rem; font-weight: 700; text-transform: uppercase; color: var(--text-muted); }
    .meta-value { font-size: 0.85rem; color: var(--primary); }
    .status-badge { font-size: 0.75rem; font-weight: 700; padding: 2px 8px; border-radius: 4px; display: inline-block; width: fit-content; }
    .status-open { background: #fee2e2; color: #b91c1c; }
    .status-fixed { background: #d1fae5; color: #065f46; }

    /* CVSS Banner */
    .cvss-banner {
      display: flex;
      align-items: center;
      gap: 16px;
      margin: 16px 24px;
      padding: 12px 16px;
      border-radius: 8px;
      background: #f8fafc;
      border: 1px solid var(--border);
    }
    .cvss-score-circle {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-width: 60px;
      height: 60px;
      border-radius: 8px;
      background: var(--primary);
      color: #fff;
    }
    .cvss-critical .cvss-score-circle { background: var(--critical); }
    .cvss-high .cvss-score-circle { background: var(--high); }
    .cvss-medium .cvss-score-circle { background: var(--medium); }
    .cvss-low .cvss-score-circle { background: var(--low); }

    .cvss-score-num { font-size: 1.4rem; font-weight: 800; line-height: 1; }
    .cvss-score-label { font-size: 0.65rem; font-weight: 700; text-transform: uppercase; }
    .cvss-vector-info { display: flex; flex-direction: column; gap: 4px; }
    .cvss-vtitle { font-size: 0.78rem; font-weight: 700; color: var(--primary); }
    .cvss-vector-str { font-family: monospace; font-size: 0.78rem; color: var(--text-muted); word-break: break-all; }

    .finding-section { padding: 16px 24px; border-bottom: 1px solid var(--border); }
    .finding-section:last-of-type { border-bottom: none; }
    .section-subtitle { font-size: 0.9rem; font-weight: 700; color: var(--primary); margin-bottom: 8px; }
    .section-text { font-size: 0.9rem; color: #334155; line-height: 1.6; }
    .poc-list { margin-left: 20px; font-size: 0.88rem; color: #334155; display: flex; flex-direction: column; gap: 6px; }
    .ref-list { margin-left: 20px; font-size: 0.85rem; color: var(--accent); }
    .ref-list a { color: var(--accent); text-decoration: none; word-break: break-all; }

    .diff-block {
      background: #0f172a;
      color: #f8fafc;
      padding: 12px 16px;
      border-radius: 6px;
      overflow-x: auto;
      font-family: 'JetBrains Mono', 'Fira Code', monospace;
      font-size: 0.8rem;
      line-height: 1.5;
    }

    code {
      font-family: 'JetBrains Mono', 'Fira Code', monospace;
      background: #f1f5f9;
      color: #0f172a;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 0.85em;
    }

    /* Roadmap Timeline */
    .roadmap-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
      margin: 20px 0;
    }
    .roadmap-card {
      background: #f8fafc;
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 16px;
    }
    .roadmap-time { font-size: 0.8rem; font-weight: 800; color: var(--accent); text-transform: uppercase; margin-bottom: 4px; }
    .roadmap-target { font-size: 0.95rem; font-weight: 700; color: var(--primary); margin-bottom: 6px; }
    .roadmap-desc { font-size: 0.85rem; color: var(--text-muted); line-height: 1.4; }

    /* Footer */
    .report-footer {
      padding: 32px 48px;
      background: #f8fafc;
      border-top: 1px solid var(--border);
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.8rem;
      color: var(--text-muted);
      flex-wrap: wrap;
      gap: 12px;
    }

    @media print {
      body { background: #ffffff; padding: 0; }
      .top-action-bar { display: none !important; }
      .report-wrapper { box-shadow: none; border: none; max-width: 100%; border-radius: 0; }
      .report-header { background: #0f172a !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .finding-card { page-break-inside: avoid; border: 1px solid #cbd5e1; }
      .cvss-banner { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .severity-pill { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      @page { margin: 1.2cm; size: A4; }
    }
  </style>
</head>
<body>
  <div class="top-action-bar">
    <div style="font-size: 0.85rem; font-weight: 600; color: var(--text-muted);">
      🔒 Executive VAPT Security Report
    </div>
    <button class="print-btn" onclick="window.print()">
      🖨️ Print / Save as PDF
    </button>
  </div>

  <div class="report-wrapper">
    <!-- Header Cover -->
    <div class="report-header">
      <span class="report-brand">NEXUS AI SECURITY AUDIT</span>
      <h1 class="report-main-title">${escapeHtml(report.title)}</h1>
      <span class="report-confidential-pill">STRICTLY CONFIDENTIAL</span>
    </div>

    <!-- Metadata Strip -->
    <div class="metadata-strip">
      <div class="meta-box">
        <span class="meta-box-label">Client Name</span>
        <span class="meta-box-val">${escapeHtml(report.clientName || 'Confidential Client')}</span>
      </div>
      <div class="meta-box">
        <span class="meta-box-label">Assessment Type</span>
        <span class="meta-box-val">${escapeHtml(report.assessmentType.toUpperCase())} Pentest</span>
      </div>
      <div class="meta-box">
        <span class="meta-box-label">Lead Auditor</span>
        <span class="meta-box-val">${escapeHtml(report.leadTester || 'Nexus Security Lead')}</span>
      </div>
      <div class="meta-box">
        <span class="meta-box-label">Assessment Period</span>
        <span class="meta-box-val">${escapeHtml(report.startDate || 'N/A')} - ${escapeHtml(report.endDate || 'N/A')}</span>
      </div>
      <div class="meta-box">
        <span class="meta-box-label">Report Date</span>
        <span class="meta-box-val">${new Date(report.createdAt).toLocaleDateString()}</span>
      </div>
    </div>

    <div class="report-body">
      <!-- 1. Executive Summary -->
      <h2 class="section-header">1. Executive Summary</h2>
      <p class="lead-paragraph">
        ${escapeHtml(
          report.executiveSummary ||
            'A comprehensive security assessment was conducted to evaluate the defensive posture and identify exploitable vulnerabilities within the target environment.'
        )}
      </p>

      <!-- Risk Distribution Dashboard -->
      <div class="risk-dashboard">
        <div class="risk-card risk-critical">
          <div class="risk-card-num">${criticalCount}</div>
          <div class="risk-card-label">Critical</div>
        </div>
        <div class="risk-card risk-high">
          <div class="risk-card-num">${highCount}</div>
          <div class="risk-card-label">High</div>
        </div>
        <div class="risk-card risk-medium">
          <div class="risk-card-num">${mediumCount}</div>
          <div class="risk-card-label">Medium</div>
        </div>
        <div class="risk-card risk-low">
          <div class="risk-card-num">${lowCount}</div>
          <div class="risk-card-label">Low</div>
        </div>
        <div class="risk-card risk-info">
          <div class="risk-card-num">${infoCount}</div>
          <div class="risk-card-label">Info</div>
        </div>
      </div>

      <!-- Vulnerabilities Overview Table -->
      <div class="table-responsive">
        <table class="summary-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Vulnerability Title</th>
              <th>Severity</th>
              <th>CVSS</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${report.findings
              .map(
                (f) => `
              <tr>
                <td><code>${escapeHtml(f.id)}</code></td>
                <td><strong>${escapeHtml(f.title)}</strong></td>
                <td><span class="severity-pill pill-${f.severity}">${f.severity.toUpperCase()}</span></td>
                <td>${f.cvss ? `<strong>${f.cvss.score}</strong>` : 'N/A'}</td>
                <td><span class="status-badge status-${f.status || 'open'}">${(f.status || 'OPEN').toUpperCase()}</span></td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>
      </div>

      <!-- 2. Scope & Methodology -->
      <h2 class="section-header">2. Assessment Scope & Methodology</h2>
      <p class="section-text" style="margin-bottom: 16px;">
        ${escapeHtml(
          report.methodology ||
            'Testing adhered to the OWASP Web Security Testing Guide (WSTG v4.2) and NIST SP 800-115 technical assessment guidelines.'
        )}
      </p>
      <div style="background: #f8fafc; padding: 14px 18px; border-radius: 8px; border: 1px solid var(--border); margin-bottom: 24px;">
        <span style="font-size: 0.75rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">In-Scope Target Assets:</span><br/>
        <code style="font-size: 0.9rem; color: var(--primary);">${escapeHtml(report.targetScope || 'All Designated Assessment Assets')}</code>
      </div>

      <!-- 3. Detailed Technical Findings -->
      <h2 class="section-header">3. Detailed Technical Findings</h2>
      ${findingsHTML}

      <!-- 4. Remediation Roadmap -->
      <h2 class="section-header">4. Remediation Roadmap & Strategy</h2>
      <p class="section-text">
        To systematically minimize operational risk, defensive engineering teams should address identified vulnerabilities according to the following priority timeline:
      </p>
      <div class="roadmap-grid">
        <div class="roadmap-card">
          <div class="roadmap-time" style="color: var(--critical);">Phase 1 (Immediate: 24-48 Hours)</div>
          <div class="roadmap-target">Critical Severity Vulnerabilities</div>
          <div class="roadmap-desc">Remediate all remote exploitation, injection vectors, and broken access controls immediately.</div>
        </div>
        <div class="roadmap-card">
          <div class="roadmap-time" style="color: var(--high);">Phase 2 (1 - 2 Weeks)</div>
          <div class="roadmap-target">High Severity Vulnerabilities</div>
          <div class="roadmap-desc">Implement strict authentication checks, input sanitization, and access matrices.</div>
        </div>
        <div class="roadmap-card">
          <div class="roadmap-time" style="color: var(--medium);">Phase 3 (30 Days)</div>
          <div class="roadmap-target">Medium & Low Severity</div>
          <div class="roadmap-desc">Address security misconfigurations, header hardening, and cookie attributes.</div>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div class="report-footer">
      <div>Generated by <strong>Nexus AI Security Studio</strong> • Confidential Client Assessment</div>
      <div>Page 1 • Final Audit Deliverable</div>
    </div>
  </div>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export const SAMPLE_VAPT_REPORT: VAPTReport = {
  id: 'vapt-sample-01',
  title: 'Web Application Security Assessment & VAPT Report',
  clientName: 'Acme Financial Systems',
  targetScope: 'https://app.acmefinance.com, https://api.acmefinance.com',
  assessmentType: 'web',
  leadTester: 'Senior Penetration Tester',
  startDate: '2026-08-15',
  endDate: '2026-08-20',
  executiveSummary:
    'A comprehensive Gray-Box Web Application Penetration Test was performed on the Acme Financial portal. Two Critical, one High, and one Medium severity issues were identified, including an authorization flaw in the transaction API and an unauthenticated SQL injection vulnerability.',
  methodology:
    'Testing was conducted according to the OWASP Web Security Testing Guide (WSTG v4.2), focusing on business logic, authentication bypass, and injection vectors.',
  status: 'final',
  createdAt: Date.now(),
  updatedAt: Date.now(),
  findings: [
    {
      id: 'FINDING-001',
      title: 'Broken Object-Level Authorization (BOLA/IDOR) in Transaction Details API',
      severity: 'critical',
      cweId: 'CWE-639',
      owaspCategory: 'API1:2023 - Broken Object Level Authorization',
      targetEndpoint: 'GET /api/v2/transactions/{transaction_id}',
      description:
        'The API endpoint fails to validate whether the authenticated user has ownership rights to the requested `transaction_id`, permitting any authenticated customer to view complete transaction histories of all users.',
      remediation:
        'Enforce strict server-side authorization checks comparing the authenticated user token claims against the account associated with the requested transaction ID.',
      pocSteps: [
        'Authenticate as standard User A and record session token.',
        'Send HTTP GET request to `/api/v2/transactions/98231` (belonging to User B).',
        'Observe HTTP 200 OK containing full financial records of User B.',
      ],
      cvss: {
        version: '3.1',
        av: 'N',
        ac: 'L',
        pr: 'L',
        ui: 'N',
        s: 'U',
        c: 'H',
        i: 'N',
        a: 'N',
        score: 6.5,
        severity: 'medium',
        vectorString: 'CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:N/A:N',
      },
      status: 'open',
    },
  ],
};
