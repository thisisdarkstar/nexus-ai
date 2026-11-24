import type { SecurityTab } from '../../types';
import { SECURITY_TAB_META } from './tabRegistry';

/** Static guidance for every tab; module-level buttons add their own live state. */
const CONTEXT_GUIDANCE: Record<SecurityTab, string> = {
  dashboard:
    'I am reviewing the engagement security posture dashboard. Help me interpret findings by severity, remediation progress, mean CVSS, technology exposure, and evidence coverage.',
  reports:
    'I am drafting a VAPT / Bug Bounty pentest report in Report Studio. Help me calculate accurate CVSS v3.1 base scores, write executive summaries, and format remediation steps.',
  scope:
    'I am mapping target scope and technologies in Scope Manager. Provide a tailored penetration testing methodology for these assets.',
  checklists:
    'I am tracking vulnerability testing against OWASP WSTG v4.2 and API Security Top 10. Help guide testing procedures for my active checklist items.',
  http_studio:
    'I am inspecting and transforming HTTP requests in the HTTP Studio. Please guide me on identifying API vulnerabilities (BOLA/IDOR, injections, missing headers) and generating test payloads.',
  api_studio:
    'I am reviewing an OpenAPI/Swagger contract and its authentication gap matrix. Help me find broken authorization, missing rate limits, insecure schemes, and OWASP API Top 10 risks.',
  payloads:
    'I am crafting exploit payloads, reverse shells, SSRF cloud metadata bypasses, and SSTI matrices. Help me tailor and troubleshoot payloads for this target.',
  decoders:
    'I am analyzing security artifacts, encoding schemes, hashes, and JWT tokens in the Decoders & JWT Hub. Please help me deobfuscate unknown payloads, analyze token signatures/claims, or identify hash types.',
  graph:
    'I am exploring a relational attack-surface graph of hosts, domains, ports, technologies, and findings. Help me identify high-value pivots and prioritise remediation by composite risk.',
  recon:
    'I am conducting reconnaissance and OSINT in the Recon Hub. Suggest advanced search queries, automation tool pipelines, and asset enumeration strategies.',
  workflow:
    'I am orchestrating a visual assessment pipeline. Help me order the steps, interpret step outputs, and keep the run aligned with scope and execution policy.',
  nuclei:
    'I am building and debugging ProjectDiscovery Nuclei v3 YAML vulnerability templates. Guide me on writing accurate matchers, extractors, and syntax rules.',
  sandbox:
    'I am executing and debugging Python security scripts in the Pyodide WebAssembly Sandbox. Help me write and troubleshoot security tooling code.',
  auditor:
    'I am performing static application security testing (SAST) in Code Auditor. Analyze the code for CWE vulnerabilities, business logic bugs, and provide secure diff patches.',
  remediation:
    'I am reviewing patch diffs, root-cause analysis, and fix verification in Remediation Hub. Help me validate that a remediation is complete and propose regression tests.',
  knowledge_base:
    'I am researching CWE and OWASP technical weaknesses in the Knowledge Base. Explain the weakness, realistic attack vectors, and defensive controls for my stack.',
  threat_studio:
    'I am creating Sigma detection rules and STRIDE threat models. Assist with detection logic, MITRE ATT&CK mapping, and mitigation strategies.',
};

/** One canonical prompt prefix for the canvas Ask AI button and copilot quick chips. */
export function getAskAiContext(tab: SecurityTab): string {
  const meta = SECURITY_TAB_META[tab];
  return `I am currently using the **${meta.name}** module in the Nexus Security Workbench.\n\n${CONTEXT_GUIDANCE[tab]}`;
}

export function getQuickPromptContext(tab: SecurityTab, suggestion: string): string {
  return `[Context: ${SECURITY_TAB_META[tab].name}]\n${suggestion}`;
}
