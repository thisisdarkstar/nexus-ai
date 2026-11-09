export const DB_NAME = 'nexus_security_workbench_db';
export const DB_VERSION = 1;

export interface StorageProject {
  id: string;
  name: string;
  clientName?: string;
  targetDomain?: string;
  createdAt: number;
  updatedAt: number;
}

export interface StorageAsset {
  id: string;
  projectId: string;
  url: string;
  host: string;
  port?: number;
  protocol?: 'http' | 'https';
  statusCode?: number;
  title?: string;
  webserver?: string;
  technologies?: string[];
  contentLength?: number;
  highInterestFlags?: string[];
  riskScore?: 'critical' | 'high' | 'medium' | 'low' | 'info';
  source?: string;
  createdAt: number;
}

export interface StorageFinding {
  id: string;
  projectId: string;
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  cweId?: string;
  owaspCategory?: string;
  targetEndpoint?: string;
  description: string;
  remediation: string;
  status: 'open' | 'confirmed' | 'remediated' | 'false_positive' | 'wont_fix' | 'triaged' | 'fixed' | 'retested' | 'accepted';
  cvss?: {
    score: number;
    vectorString: string;
    version: '3.1' | '4.0';
  };
  evidenceIds?: string[];
  createdAt: number;
  updatedAt: number;
}

export interface StorageEvidence {
  id: string;
  projectId: string;
  title: string;
  type: 'http_trace' | 'source_snippet' | 'screenshot' | 'log_output' | 'raw_record';
  sha256Hash: string;
  timestamp: number;
  content: string;
}
