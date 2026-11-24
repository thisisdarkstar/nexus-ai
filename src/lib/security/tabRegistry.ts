import type React from 'react';
import {
  Activity,
  Binary,
  BookOpen,
  CheckSquare,
  FileCode,
  FileText,
  Globe,
  Layers,
  Network,
  Radio,
  Search,
  Share2,
  ShieldAlert,
  Target,
  Terminal,
  Wrench,
  Workflow,
} from 'lucide-react';
import { SECURITY_TAB_IDS, type SecurityTab } from '../../types';

export type TabCategory = 'all' | 'assess' | 'web' | 'recon' | 'defense';

export interface SecurityTabMeta {
  id: SecurityTab;
  name: string;
  category: Exclude<TabCategory, 'all'>;
  icon: React.ComponentType<{ size?: number; color?: string; className?: string }>;
  tooltip: string;
  keywords: string[];
}

type TabMeta = Omit<SecurityTabMeta, 'id'>;

export const SECURITY_TAB_META: Record<SecurityTab, TabMeta> = {
  dashboard: {
    name: 'Dashboard', category: 'assess', icon: Activity,
    tooltip: 'Security Posture & Engagement Executive Dashboard', keywords: ['posture', 'cvss', 'kpi', 'metrics'],
  },
  reports: {
    name: 'Reports', category: 'assess', icon: FileText,
    tooltip: 'VAPT & Bug Bounty Report Studio (CVSS Calculator)', keywords: ['report', 'vapt', 'bug bounty', 'cvss'],
  },
  scope: {
    name: 'Scope', category: 'assess', icon: Target,
    tooltip: 'Target Scope & Asset Matrix', keywords: ['targets', 'assets', 'in-scope', 'rules'],
  },
  checklists: {
    name: 'Checklists', category: 'assess', icon: CheckSquare,
    tooltip: 'OWASP WSTG v4.2 & API Checklist', keywords: ['owasp', 'wstg', 'methodology', 'tests'],
  },
  http_studio: {
    name: 'HTTP Studio', category: 'web', icon: Globe,
    tooltip: 'Burp Request Parser, cURL/Python Converter & Fuzzing', keywords: ['burp', 'request', 'curl', 'fuzz', 'headers'],
  },
  api_studio: {
    name: 'API Studio', category: 'web', icon: Network,
    tooltip: 'OpenAPI 3.0 / Swagger Contract Reviewer & Auth Gap Matrix', keywords: ['openapi', 'swagger', 'api', 'auth'],
  },
  payloads: {
    name: 'Payloads', category: 'web', icon: Radio,
    tooltip: 'Reverse Shell Generator, SSRF Cloud & SSTI Matrix', keywords: ['reverse shell', 'ssrf', 'ssti', 'lhost'],
  },
  decoders: {
    name: 'Decoders', category: 'web', icon: Binary,
    tooltip: 'JWT Inspector, Encoders & Hashes', keywords: ['jwt', 'base64', 'hash', 'xor', 'entropy'],
  },
  graph: {
    name: 'Asset Graph', category: 'recon', icon: Share2,
    tooltip: 'Relational Attack Surface Entity-Relationship Graph', keywords: ['attack surface', 'relationships', 'entities'],
  },
  recon: {
    name: 'Recon Hub', category: 'recon', icon: Search,
    tooltip: 'Recon CLI Tool Chains & Google/GitHub Dorks', keywords: ['osint', 'nmap', 'amass', 'dorks', 'sublist3r'],
  },
  workflow: {
    name: 'Workflows', category: 'recon', icon: Workflow,
    tooltip: 'Visual Assessment Orchestration & Pipeline Runner', keywords: ['pipeline', 'orchestration', 'replay', 'steps'],
  },
  nuclei: {
    name: 'Nuclei Studio', category: 'recon', icon: FileCode,
    tooltip: 'Nuclei v3 YAML Template Builder', keywords: ['yaml', 'templates', 'projectdiscovery', 'scanner'],
  },
  sandbox: {
    name: 'Sandbox', category: 'recon', icon: Terminal,
    tooltip: 'In-Browser Python Wasm Runtime', keywords: ['python', 'pyodide', 'wasm', 'scripts'],
  },
  auditor: {
    name: 'SAST Audit', category: 'defense', icon: ShieldAlert,
    tooltip: 'Static Vulnerability Code Auditor', keywords: ['sast', 'code', 'cwe', 'vulnerabilities'],
  },
  remediation: {
    name: 'Remediation', category: 'defense', icon: Wrench,
    tooltip: 'Patch Diff Viewer, Root-Cause & Fix Verification', keywords: ['patches', 'fixes', 'diff', 'verification'],
  },
  knowledge_base: {
    name: 'Knowledge Base', category: 'defense', icon: BookOpen,
    tooltip: 'CWE & OWASP Technical Weakness Encyclopedia', keywords: ['cwe', 'owasp', 'weakness', 'reference'],
  },
  threat_studio: {
    name: 'Threat Studio', category: 'defense', icon: Layers,
    tooltip: 'Sigma Rules & STRIDE Threat Modeler', keywords: ['sigma', 'stride', 'mitre', 'detection', 'yara'],
  },
};

/** Ordered registry used by the canvas, command palette, and AI context tools. */
export const SECURITY_TABS: readonly SecurityTabMeta[] = SECURITY_TAB_IDS.map((id) => ({
  id,
  ...SECURITY_TAB_META[id],
}));
