import { describe, it, expect, beforeEach, vi } from 'vitest';
import { exportEngagementBundle, importEngagementBundle } from '../lib/security/engagementBundle';
import { db } from '../lib/db';
import { storageManager } from '../core/storage/StorageManager';
import {
  DEFAULT_PROJECT_ID,
  getActiveProjectId,
  projectLocalStorage,
  setActiveProjectId,
} from '../core/storage/projectStorage';
import type { Chat, Project, ReconAsset } from '../types';
import {
  analyzeHttpSecurity,
  computeResponseDiff,
  generateHttpCodeSnippets,
  parseRawHttpRequest,
} from '../lib/security/httpHelpers';
import {
  buildCloudBuckets,
  buildGithubDorks,
  buildGoogleDorks,
  buildReconPipelines,
} from '../lib/security/reconPresets';

async function blobToText(blob: Blob): Promise<string> {
  if (typeof blob.text === 'function') {
    return blob.text();
  }
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}

describe('.nexus Engagement Bundle round-trip & helpers', () => {
  beforeEach(() => {
    localStorage.clear();
    setActiveProjectId(DEFAULT_PROJECT_ID);
    vi.restoreAllMocks();
  });

  it('round-trips full module state and isolates across engagements on import', async () => {
    const projectsStore: Project[] = [
      {
        id: 'eng-alpha',
        name: 'Alpha Bank',
        createdAt: 1000,
      },
    ];
    const chatsStore: Chat[] = [
      {
        id: 'chat-alpha-1',
        title: 'Alpha Triage',
        workspaceId: 'eng-alpha',
        createdAt: 1000,
        updatedAt: 2000,
        messages: [],
      },
    ];
    const assetsStore: ReconAsset[] = [
      {
        id: 'asset-alpha-1',
        url: 'https://api.alpha.test/graphql',
        host: 'api.alpha.test',
        port: 443,
        protocol: 'https',
        statusCode: 200,
        riskScore: 'high',
        highInterestFlags: ['GraphQL Endpoint'],
        createdAt: 1000,
      },
    ];

    vi.spyOn(db, 'getProjects').mockImplementation(async () => [...projectsStore]);
    vi.spyOn(db, 'getChats').mockImplementation(async () => [...chatsStore]);
    vi.spyOn(db, 'saveProject').mockImplementation(async (proj) => {
      const idx = projectsStore.findIndex((p) => p.id === proj.id);
      if (idx >= 0) projectsStore[idx] = proj;
      else projectsStore.push(proj);
    });
    vi.spyOn(db, 'saveChat').mockImplementation(async (chat) => {
      const idx = chatsStore.findIndex((c) => c.id === chat.id);
      if (idx >= 0) chatsStore[idx] = chat;
      else chatsStore.push(chat);
    });
    vi.spyOn(storageManager, 'getAssets').mockImplementation(async () => assetsStore as never);
    vi.spyOn(storageManager, 'saveAssets').mockImplementation(async (items) => {
      assetsStore.splice(0, assetsStore.length, ...(items as unknown as ReconAsset[]));
    });

    setActiveProjectId('eng-alpha');

    // Seed project-scoped module state in eng-alpha
    projectLocalStorage.setItem('nexus_security_report', JSON.stringify({ id: 'rep-1', title: 'Alpha Audit', findings: [{ id: 'F-1', title: 'IDOR', severity: 'high' }] }));
    projectLocalStorage.setItem('nexus_security_scope', JSON.stringify([{ id: 'sc-1', target: 'api.alpha.test', type: 'api', inScope: true, techStack: [], notes: '', status: 'untested' }]));
    projectLocalStorage.setItem('nexus_security_checklist', JSON.stringify({ 'WSTG-ATHN-01': 'passed' }));
    projectLocalStorage.setItem('nexus_security_http_request', 'GET /api/v1/users?id=42 HTTP/1.1\nHost: api.alpha.test\n\n');
    projectLocalStorage.setItem('nexus_security_notemap_v1', JSON.stringify({ notes: [{ id: 'n1', title: 'Pivot Note' }], nodes: [], edges: [] }));
    projectLocalStorage.setItem('nexus_security_api_studio_v1', JSON.stringify({ specText: 'openapi: 3.0.0' }));
    projectLocalStorage.setItem('nexus_security_code_auditor_v1', JSON.stringify({ code: 'eval(userInput)' }));
    projectLocalStorage.setItem('nexus_security_sandbox_v1', JSON.stringify({ code: 'print(42)' }));
    projectLocalStorage.setItem('nexus_security_kb_v1', JSON.stringify({ searchQuery: 'CWE-89' }));
    projectLocalStorage.setItem('nexus_copilot_vault_docs_v1', JSON.stringify([{ id: 'doc-1', name: 'burp.xml', scope: 'project', enabled: true, chunks: [] }]));

    let capturedBlob: Blob | null = null;
    vi.spyOn(URL, 'createObjectURL').mockImplementation((obj: Blob | MediaSource) => {
      capturedBlob = obj as Blob;
      return 'blob:nexus-bundle-mock';
    });
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    await exportEngagementBundle('eng-alpha');
    expect(capturedBlob).not.toBeNull();

    const bundleJson = await blobToText(capturedBlob!);
    const parsed = JSON.parse(bundleJson);
    expect(parsed.project.id).toBe('eng-alpha');
    expect(parsed.project.name).toBe('Alpha Bank');
    expect(parsed.chats).toHaveLength(1);
    expect(parsed.reconAssets).toHaveLength(1);
    expect(parsed.notemap.notes[0].title).toBe('Pivot Note');
    expect(parsed.apiStudio.specText).toBe('openapi: 3.0.0');
    expect(parsed.codeAuditor.code).toBe('eval(userInput)');
    expect(parsed.sandbox.code).toBe('print(42)');
    expect(parsed.knowledgeBase.searchQuery).toBe('CWE-89');
    expect(parsed.vaultDocs).toHaveLength(1);

    // Clear in-memory stores & seed an unrelated eng-beta engagement before importing
    projectsStore.length = 0;
    chatsStore.length = 0;
    assetsStore.length = 0;
    localStorage.clear();
    setActiveProjectId('eng-beta');
    projectLocalStorage.setItem('nexus_security_code_auditor_v1', JSON.stringify({ code: 'beta_only()' }));

    const file = new File([bundleJson], 'alpha.nexus', { type: 'application/json' });
    if (typeof file.text !== 'function') {
      Object.defineProperty(file, 'text', { value: async () => bundleJson });
    }

    const summary = await importEngagementBundle(file);
    expect(summary.projectName).toBe('Alpha Bank');
    expect(summary.chatsCount).toBe(1);
    expect(summary.findingsCount).toBe(1);
    expect(summary.scopeCount).toBe(1);
    expect(projectsStore.some((p) => p.id === 'eng-alpha')).toBe(true);
    expect(chatsStore.some((c) => c.id === 'chat-alpha-1')).toBe(true);
    expect(assetsStore.some((a) => a.id === 'asset-alpha-1')).toBe(true);

    // Restored into eng-alpha without clobbering eng-beta
    setActiveProjectId('eng-beta');
    expect(projectLocalStorage.getItem('nexus_security_code_auditor_v1')).toContain('beta_only()');
    expect(projectLocalStorage.getItem('nexus_security_notemap_v1')).toBeNull();

    setActiveProjectId('eng-alpha');
    expect(getActiveProjectId()).toBe('eng-alpha');
    expect(projectLocalStorage.getItem('nexus_security_notemap_v1')).toContain('Pivot Note');
    expect(projectLocalStorage.getItem('nexus_security_api_studio_v1')).toContain('openapi: 3.0.0');
    expect(projectLocalStorage.getItem('nexus_security_code_auditor_v1')).toContain('eval(userInput)');
    expect(projectLocalStorage.getItem('nexus_security_sandbox_v1')).toContain('print(42)');
    expect(projectLocalStorage.getItem('nexus_security_kb_v1')).toContain('CWE-89');
    expect(projectLocalStorage.getItem('nexus_copilot_vault_docs_v1')).toContain('burp.xml');
  });

  it('parses HTTP requests, generates client snippets, flags risks, and computes response diffs', () => {
    const raw = [
      'POST /api/v1/orders?user_id=105 HTTP/1.1',
      'Host: api.example.com',
      'X-Forwarded-For: 127.0.0.1',
      'Content-Type: application/json',
      'Cookie: sid=abc123',
      '',
      '{"amount":10}',
    ].join('\n');

    const parsed = parseRawHttpRequest(raw);
    expect(parsed.method).toBe('POST');
    expect(parsed.fullUrl).toBe('https://api.example.com/api/v1/orders?user_id=105');
    expect(parsed.cookies).toEqual([{ key: 'sid', value: 'abc123' }]);
    expect(parsed.queryParams).toEqual([{ key: 'user_id', value: '105' }]);

    const snippets = generateHttpCodeSnippets(parsed);
    expect(snippets.curl).toContain('curl -X POST "https://api.example.com/api/v1/orders?user_id=105"');
    expect(snippets.python).toContain('requests.post');
    expect(snippets.javascript).toContain('fetch(');
    expect(snippets.go).toContain('http.NewRequest');
    expect(snippets.powershell).toContain('Invoke-RestMethod');

    const findings = analyzeHttpSecurity(parsed);
    expect(findings.some((f) => f.title.includes('Encrypted HTTPS Transport'))).toBe(true);
    expect(findings.some((f) => f.title.includes('IP Spoofing'))).toBe(true);
    expect(findings.some((f) => f.title.includes('BOLA / IDOR'))).toBe(true);

    const diff = computeResponseDiff('{"ok":true}\nline2', '{"ok":false}\nline2');
    expect(diff).toEqual([
      { type: 'rem', line: '{"ok":true}' },
      { type: 'add', line: '{"ok":false}' },
      { type: 'same', line: 'line2' },
    ]);
  });

  it('builds domain-scoped recon pipelines, dorks, and cloud buckets', () => {
    expect(buildReconPipelines('target.io').every((p) => p.command.includes('target.io'))).toBe(true);
    expect(buildGoogleDorks('target.io')[0].query).toContain('site:target.io');
    expect(buildGithubDorks('target.io')[0].query).toContain('"target.io"');
    expect(buildCloudBuckets('sub.target.io').map((b) => b.url)).toContain(
      'https://sub-target-io.s3.amazonaws.com'
    );
  });
});
