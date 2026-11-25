import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import CodeAuditor from '../components/security/CodeAuditor';
import SandboxTerminal from '../components/security/SandboxTerminal';
import KnowledgeBase from '../components/security/KnowledgeBase';
import ApiStudio from '../components/security/ApiStudio';
import { ToastProvider } from '../lib/toast';
import { DEFAULT_PROJECT_ID, setActiveProjectId } from '../core/storage/projectStorage';
import { vaultStore } from '../lib/rag/vaultStore';

describe('Phase 2 persistence and engagement isolation', () => {
  beforeEach(() => {
    localStorage.clear();
    setActiveProjectId(DEFAULT_PROJECT_ID);
    vaultStore.clearAll();
  });

  it('persists CodeAuditor source code across unmount/remount and isolates per engagement', () => {
    setActiveProjectId('alpha');
    const { unmount } = render(<CodeAuditor />);
    const editor = screen.getByPlaceholderText(/Paste source code/i) as HTMLTextAreaElement;
    fireEvent.change(editor, { target: { value: 'print("alpha engagement code")' } });
    unmount();

    // Switching to beta engagement must not show alpha code
    setActiveProjectId('beta');
    const betaRender = render(<CodeAuditor />);
    expect(
      (screen.getByPlaceholderText(/Paste source code/i) as HTMLTextAreaElement).value
    ).not.toContain('alpha engagement code');
    betaRender.unmount();

    // Returning to alpha restores alpha code
    setActiveProjectId('alpha');
    render(<CodeAuditor />);
    expect(
      (screen.getByPlaceholderText(/Paste source code/i) as HTMLTextAreaElement).value
    ).toBe('print("alpha engagement code")');
  });

  it('persists SandboxTerminal, KnowledgeBase, and ApiStudio state per engagement', () => {
    setActiveProjectId('alpha');

    // SandboxTerminal
    const sb = render(<SandboxTerminal />);
    const sbArea = screen.getByPlaceholderText(/Write Python code/i) as HTMLTextAreaElement;
    fireEvent.change(sbArea, { target: { value: 'print("persisted_sandbox")' } });
    sb.unmount();

    // KnowledgeBase
    const kb = render(
      <ToastProvider>
        <KnowledgeBase />
      </ToastProvider>
    );
    const kbSearch = screen.getByPlaceholderText(/Search weaknesses/i) as HTMLInputElement;
    fireEvent.change(kbSearch, { target: { value: 'CWE-89' } });
    kb.unmount();

    // ApiStudio
    const api = render(
      <ToastProvider>
        <ApiStudio />
      </ToastProvider>
    );
    const apiSearch = screen.getByPlaceholderText(/Search endpoints/i) as HTMLInputElement;
    fireEvent.change(apiSearch, { target: { value: 'impersonate' } });
    api.unmount();

    // Verify all 3 restore cleanly in alpha after remount
    render(<SandboxTerminal />);
    expect((screen.getByPlaceholderText(/Write Python code/i) as HTMLTextAreaElement).value).toBe(
      'print("persisted_sandbox")'
    );

    render(
      <ToastProvider>
        <KnowledgeBase />
      </ToastProvider>
    );
    expect((screen.getByPlaceholderText(/Search weaknesses/i) as HTMLInputElement).value).toBe('CWE-89');

    render(
      <ToastProvider>
        <ApiStudio />
      </ToastProvider>
    );
    expect((screen.getByPlaceholderText(/Search endpoints/i) as HTMLInputElement).value).toBe(
      'impersonate'
    );
  });

  it('isolates project-scoped Vault documents across engagements while sharing Global playbooks', async () => {
    setActiveProjectId('eng_a');
    vaultStore.reloadForProject();
    await vaultStore.addDocument('client_a_scope.txt', 'internal-a.corp', 'project');
    const globalDoc = await vaultStore.addDocument('owasp_playbook.md', 'OWASP methodology', 'global');
    expect(vaultStore.getDocuments().map((d) => d.name)).toContain('client_a_scope.txt');
    expect(vaultStore.getDocuments().map((d) => d.name)).toContain('owasp_playbook.md');

    setActiveProjectId('eng_b');
    vaultStore.reloadForProject();
    const engBNames = vaultStore.getDocuments().map((d) => d.name);
    expect(engBNames).not.toContain('client_a_scope.txt');
    expect(engBNames).toContain('owasp_playbook.md');

    // Toggle global doc back to project in eng_b and confirm eng_a retains its own scope doc
    vaultStore.toggleDocumentScope(globalDoc.id);
    setActiveProjectId('eng_a');
    vaultStore.reloadForProject();
    expect(vaultStore.getDocuments().map((d) => d.name)).toEqual(['client_a_scope.txt']);
  });
});
