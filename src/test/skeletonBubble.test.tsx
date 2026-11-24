import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';
import SkeletonBubble from '../components/chat/SkeletonBubble';

describe('SkeletonBubble', () => {
  it('applies custom width when provided and leaves default CSS width intact when omitted', () => {
    const { container, rerender } = render(<SkeletonBubble />);
    const defaultBox = container.querySelector('[class*="skeleton"]') as HTMLElement | null;
    expect(defaultBox).toBeTruthy();
    expect(defaultBox?.style.width).toBe('');

    rerender(<SkeletonBubble width="240px" isUser />);
    const customBox = container.querySelector('[class*="skeleton"]') as HTMLElement | null;
    expect(customBox?.style.width).toBe('240px');
  });
});
