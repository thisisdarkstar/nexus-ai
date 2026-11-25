import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import NoteMapStudio from '../components/notemap/NoteMapStudio';

describe('NoteMapStudio floating access and persistence', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders floating button everywhere, opens studio on click, switches modes without losing drafts, and persists across close/reopen', async () => {
    const onSendToAI = vi.fn();
    render(<NoteMapStudio projectId="default" onSendToAI={onSendToAI} />);

    // Floating button is always visible
    const fab = screen.getByRole('button', { name: /Open Notes & Mindmap/i });
    expect(fab).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();

    // Open studio
    fireEvent.click(fab);
    expect(await screen.findByRole('dialog', { name: /Nexus Notes and Mindmap Studio/i })).toBeTruthy();

    // Switch to Notepad tab and type a note (lazy chunk)
    fireEvent.click(screen.getByRole('tab', { name: /Notepad/i }));
    const noteArea = (await screen.findByLabelText(
      /Security note markdown content/i,
      {},
      { timeout: 10000 }
    )) as HTMLTextAreaElement;
    fireEvent.change(noteArea, { target: { value: '# Persistent Field Note\n## IDOR Check' } });

    // Switch to Mindmap tab, then back to Split — both must stay mounted with draft preserved
    fireEvent.click(screen.getByRole('tab', { name: /Mindmap/i }));
    fireEvent.click(screen.getByRole('tab', { name: /Split/i }));
    expect(
      (screen.getByLabelText(/Security note markdown content/i) as HTMLTextAreaElement).value
    ).toContain('Persistent Field Note');

    // Sync headings to mindmap
    fireEvent.click(screen.getByRole('button', { name: /Sync Headings/i }));
    expect(screen.getAllByText('Persistent Field Note').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('IDOR Check').length).toBeGreaterThanOrEqual(2);

    // Close and reopen via floating trigger — edits & undoable mindmap remain preserved
    fireEvent.click(screen.getByRole('button', { name: /Close studio/i }));
    fireEvent.click(screen.getByRole('button', { name: /Open Notes & Mindmap/i }));
    expect(
      (screen.getByLabelText(/Security note markdown content/i) as HTMLTextAreaElement).value
    ).toContain('Persistent Field Note');
  }, 15000);
});
