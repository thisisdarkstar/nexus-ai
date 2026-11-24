import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, act } from '@testing-library/react';
import ThinkingBlock from '../components/chat/ThinkingBlock';

describe('ThinkingBlock component', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-25T01:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('displays a ticking live timer while active and freezes to Thought for Xs upon completion', () => {
    const startMs = Date.now();
    const { rerender, container } = render(
      <ThinkingBlock thinking="Analyzing vulnerability..." isActive startedAt={startMs} />
    );

    expect(screen.getByText('Thinking...')).toBeTruthy();
    expect(screen.getByLabelText('Thinking elapsed time').textContent).toBe('0.0s');

    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(screen.getByLabelText('Thinking elapsed time').textContent).toBe('1.5s');

    // Finish thinking and pass final duration
    rerender(
      <ThinkingBlock
        thinking="Analyzing vulnerability..."
        isActive={false}
        startedAt={startMs}
        duration="1.5"
      />
    );
    expect(screen.getByText('Thought for 1.5s')).toBeTruthy();
    expect(screen.queryByLabelText('Thinking elapsed time')).toBeNull();

    // Ensure no nested buttons exist inside the header
    expect(container.querySelectorAll('button button').length).toBe(0);
  });

  it('displays Thought Process for historical messages without recorded duration', () => {
    render(<ThinkingBlock thinking="Legacy saved reasoning trace." isActive={false} />);
    expect(screen.getByText('Thought Process')).toBeTruthy();
    expect(screen.getByText('4 words')).toBeTruthy();
  });
});
