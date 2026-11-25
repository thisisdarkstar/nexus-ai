import { describe, it, expect, beforeEach, vi } from 'vitest';
import React, { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ModuleErrorBoundary from '../components/common/ModuleErrorBoundary';
import MindmapCanvas from '../components/notemap/MindmapCanvas';
import { eventBus } from '../core/bus/EventBus';
import { projectLocalStorage } from '../core/storage/projectStorage';
import { createStarterDocument, loadNoteMapWorkspace } from '../lib/notemap/storage';
import { workbenchBridge } from '../lib/security/workbenchBridge';

function Thrower({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error('Simulated module crash');
  }
  return <div>Recovered Module Body</div>;
}

describe('Phase 3 workflow synergy and module error boundary', () => {
  beforeEach(() => {
    localStorage.clear();
    eventBus.clear();
  });

  it('isolates crashes in ModuleErrorBoundary and recovers on Retry Module', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    function Wrapper() {
      const [crash, setCrash] = useState(true);
      return (
        <div>
          <button type="button" onClick={() => setCrash(false)}>
            Fix State
          </button>
          <ModuleErrorBoundary moduleName="Test Tool">
            <Thrower shouldThrow={crash} />
          </ModuleErrorBoundary>
        </div>
      );
    }

    render(<Wrapper />);
    expect(screen.getByRole('alert').textContent).toContain('Test Tool encountered an error');
    expect(screen.getByRole('alert').textContent).toContain('Simulated module crash');

    fireEvent.click(screen.getByRole('button', { name: /Fix State/i }));
    fireEvent.click(screen.getByRole('button', { name: /Retry Module/i }));
    expect(screen.getByText('Recovered Module Body')).toBeTruthy();
    spy.mockRestore();
  });

  it('adds findings to active Mindmap via workbenchBridge and promotes Mindmap nodes back to VAPT Report', () => {
    const addedEvents: unknown[] = [];
    const unsub = eventBus.subscribe('workbench:add-finding', (f) => addedEvents.push(f));

    workbenchBridge.addNodeToMindmap({
      text: 'Injected SAST SQLi',
      tag: 'CRITICAL',
      notes: 'Unsanitized query param',
      accent: 'rose',
    });

    const workspace = loadNoteMapWorkspace();
    const doc = workspace.documents[0];
    expect(Object.values(doc.mindmap.nodes).some((n) => n.text === 'Injected SAST SQLi')).toBe(
      true
    );

    render(
      <MindmapCanvas
        mindmap={createStarterDocument().mindmap}
        onChange={vi.fn()}
      />
    );

    const promoteBtn = screen.getByRole('button', { name: /\+ Report/i });
    fireEvent.click(promoteBtn);

    expect(addedEvents).toHaveLength(1);
    const storedReport = JSON.parse(projectLocalStorage.getItem('nexus_security_report') || '{}');
    expect(Array.isArray(storedReport.findings)).toBe(true);
    expect(storedReport.findings[0].title).toBe('Target Attack Surface');

    unsub();
  });
});
