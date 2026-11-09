import { describe, it, expect } from 'vitest';
import { KNOWLEDGE_BASE_ENTRIES } from '../domain/knowledge/KnowledgeBaseData';

describe('Security Knowledge Base', () => {
  it('contains comprehensive coverage of top critical CWEs', () => {
    const ids = KNOWLEDGE_BASE_ENTRIES.map((e) => e.id);
    expect(ids).toContain('CWE-89'); // SQL Injection
    expect(ids).toContain('CWE-78'); // Command Injection
    expect(ids).toContain('CWE-918'); // SSRF
    expect(ids).toContain('CWE-639'); // BOLA / IDOR
    expect(ids).toContain('CWE-502'); // Deserialization
    expect(ids).toContain('CWE-79'); // XSS
  });

  it('guarantees each knowledge entry has defensive controls and before/after code samples', () => {
    KNOWLEDGE_BASE_ENTRIES.forEach((entry) => {
      expect(entry.defensiveControls.length).toBeGreaterThan(0);
      expect(entry.attackVectors.length).toBeGreaterThan(0);
      expect(entry.codeSample.vulnerable).toBeDefined();
      expect(entry.codeSample.secure).toBeDefined();
      expect(entry.codeSample.language).toBeTruthy();
    });
  });

  it('correctly associates entries with valid OWASP classifications', () => {
    KNOWLEDGE_BASE_ENTRIES.forEach((entry) => {
      expect(entry.owaspCategory).toMatch(/(?:A\d{2}:2021|API\d{1}:2023)/);
    });
  });
});

