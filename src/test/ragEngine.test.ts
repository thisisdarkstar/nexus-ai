import { describe, it, expect, beforeEach } from 'vitest';
import { chunkDocument, estimateTokens } from '../lib/rag/documentChunker';
import { SimpleVectorSearch, tokenize } from '../lib/rag/simpleVectorSearch';
import { vaultStore } from '../lib/rag/vaultStore';

describe('Document Chunker', () => {
  it('estimates token counts based on character heuristics', () => {
    expect(estimateTokens('')).toBe(0);
    expect(estimateTokens('Hello world')).toBe(3); // 11 / 3.8 = 2.89 -> 3
  });

  it('keeps short documents as a single chunk', () => {
    const text = 'Nmap scan report for api.nexus.internal (10.0.1.42)\nPORT 80/tcp open http';
    const chunks = chunkDocument('doc1', 'nmap.txt', text, { chunkSize: 500 });
    expect(chunks.length).toBe(1);
    expect(chunks[0].chunkIndex).toBe(0);
    expect(chunks[0].totalChunks).toBe(1);
    expect(chunks[0].docName).toBe('nmap.txt');
    expect(chunks[0].text).toBe(text);
  });

  it('chunks large documents by paragraph and preserves overlap', () => {
    const paragraphs = [
      '# Vulnerability Report\nTarget endpoint: https://api.internal/v1/auth/login',
      'The login parameter suffers from SQL injection in the username field due to raw concatenation.',
      'PoC payload: admin\' OR 1=1 -- - resulted in immediate authentication bypass.',
      'Remediation: Use parameterized queries or ORM prepared statements.',
    ];
    const text = paragraphs.join('\n\n');
    const chunks = chunkDocument('doc2', 'vuln.md', text, { chunkSize: 120, overlap: 30 });
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].totalChunks).toBe(chunks.length);
    for (let i = 0; i < chunks.length; i++) {
      expect(chunks[i].chunkIndex).toBe(i);
      expect(chunks[i].text.length).toBeGreaterThan(0);
    }
  });
});

describe('Simple Vector / BM25 Search Engine', () => {
  const searchEngine = new SimpleVectorSearch();

  it('tokenizes cyber tokens preserving hyphens, ports, and cwes', () => {
    const tokens = tokenize('Found CVE-2023-38606 and CWE-79 on port 8080 at 192.168.1.100');
    expect(tokens).toContain('cve-2023-38606');
    expect(tokens).toContain('cwe-79');
    expect(tokens).toContain('8080');
    expect(tokens).toContain('192.168.1.100');
  });

  it('ranks relevant security chunks above non-relevant chunks', () => {
    const chunks = [
      {
        id: 'c1',
        docId: 'd1',
        docName: 'nmap_scan.xml',
        chunkIndex: 0,
        totalChunks: 2,
        text: 'Nmap scan report for 10.0.0.1: Port 22 ssh open, Port 80 http open, Port 3306 mysql open',
        tokenEstimate: 20,
      },
      {
        id: 'c2',
        docId: 'd2',
        docName: 'jwt_auth.js',
        chunkIndex: 0,
        totalChunks: 1,
        text: 'const jwt = require("jsonwebtoken"); function verifyToken(req) { jwt.verify(req.token, "hardcoded_secret"); }',
        tokenEstimate: 25,
      },
      {
        id: 'c3',
        docId: 'd3',
        docName: 'database_schema.sql',
        chunkIndex: 0,
        totalChunks: 1,
        text: 'CREATE TABLE users (id INT PRIMARY KEY, username VARCHAR(50), password_hash VARCHAR(255));',
        tokenEstimate: 20,
      },
    ];

    const results = searchEngine.search('hardcoded jwt secret token', chunks, 2);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].docName).toBe('jwt_auth.js');
    expect(results[0].score).toBeGreaterThan(0.5);

    const portResults = searchEngine.search('port 3306 mysql', chunks, 2);
    expect(portResults.length).toBeGreaterThan(0);
    expect(portResults[0].docName).toBe('nmap_scan.xml');
  });

  it('returns empty results on empty query or empty chunks', () => {
    expect(searchEngine.search('', [])).toEqual([]);
    expect(searchEngine.search('test', [])).toEqual([]);
  });
});

describe('Knowledge Vault Store', () => {
  beforeEach(() => {
    vaultStore.clearAll();
  });

  it('adds document and breaks it into indexed chunks', async () => {
    const doc = await vaultStore.addDocument(
      'recon_subdomains.txt',
      'admin.nexus.local\napi.nexus.local\nstaging.nexus.local\ncorp.nexus.local'
    );
    expect(doc.name).toBe('recon_subdomains.txt');
    expect(doc.chunks.length).toBeGreaterThanOrEqual(1);
    expect(doc.enabled).toBe(true);
    expect(vaultStore.getDocuments().length).toBe(1);
    expect(vaultStore.getActiveChunks().length).toBe(doc.chunks.length);
  });

  it('allows toggling document active status for RAG', async () => {
    const doc = await vaultStore.addDocument('audit.log', 'GET /admin 403 Forbidden\nPOST /login 200 OK');
    expect(vaultStore.getActiveChunks().length).toBe(1);

    vaultStore.toggleDocument(doc.id, false);
    expect(vaultStore.getActiveChunks().length).toBe(0);

    vaultStore.toggleDocument(doc.id, true);
    expect(vaultStore.getActiveChunks().length).toBe(1);
  });

  it('searches across active documents only', async () => {
    const doc1 = await vaultStore.addDocument('doc1.txt', 'Vulnerability found: SQL injection in search parameter');
    const doc2 = await vaultStore.addDocument('doc2.txt', 'Cross Site Scripting XSS stored in comments');

    let hits = vaultStore.search('sql injection');
    expect(hits.length).toBe(1);
    expect(hits[0].docName).toBe('doc1.txt');

    // Mute doc1
    vaultStore.toggleDocument(doc1.id, false);
    hits = vaultStore.search('sql injection');
    expect(hits.length).toBe(0); // Not retrieved because it is muted

    // Remove doc2
    vaultStore.removeDocument(doc2.id);
    expect(vaultStore.getDocuments().length).toBe(1);
  });
});
