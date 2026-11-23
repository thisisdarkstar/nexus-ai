import { describe, it, expect } from 'vitest';
import { extractThinkingAndContent } from '../lib/thinkingParser';

describe('extractThinkingAndContent', () => {
  it('parses complete <think>...</think> tags cleanly', () => {
    const raw = `<think>
I need to examine the user prompt.
Looking up ProjectDiscovery Nuclei v3 syntax.
</think>

Here is the comprehensive guide to Nuclei v3:
1. Overview
2. Matchers`;

    const result = extractThinkingAndContent(raw);
    expect(result.thinking).toBe(
      'I need to examine the user prompt.\nLooking up ProjectDiscovery Nuclei v3 syntax.'
    );
    expect(result.content).toBe(
      'Here is the comprehensive guide to Nuclei v3:\n1. Overview\n2. Matchers'
    );
    expect(result.isThinkingActive).toBe(false);
  });

  it('handles streaming unclosed <think>... properly', () => {
    const raw = `<think>
Currently reasoning about CVE-2024-1234...`;

    const result = extractThinkingAndContent(raw);
    expect(result.thinking).toBe('Currently reasoning about CVE-2024-1234...');
    expect(result.content).toBe('');
    expect(result.isThinkingActive).toBe(true);
  });

  it('parses legacy blockquote thinking (> *Thinking:*\\n>)', () => {
    const raw = `> *Thinking:*
> - The user is asking for guidance on Nuclei v3 YAML templates.
> - I will provide a comprehensive guide.
> 
> Examples of debugging strategies.

Here is a comprehensive guide to building and debugging ProjectDiscovery Nuclei v3 YAML templates.`;

    const result = extractThinkingAndContent(raw);
    expect(result.thinking).toContain('- The user is asking for guidance on Nuclei v3 YAML templates.');
    expect(result.thinking).toContain('Examples of debugging strategies.');
    expect(result.content).toBe(
      'Here is a comprehensive guide to building and debugging ProjectDiscovery Nuclei v3 YAML templates.'
    );
    expect(result.isThinkingActive).toBe(false);
  });

  it('returns raw text as content when no thinking tags are present', () => {
    const raw = 'Normal assistant response without any internal reasoning.';
    const result = extractThinkingAndContent(raw);
    expect(result.thinking).toBeNull();
    expect(result.content).toBe(raw);
    expect(result.isThinkingActive).toBe(false);
  });

  it('handles empty input gracefully', () => {
    const result = extractThinkingAndContent('');
    expect(result.thinking).toBeNull();
    expect(result.content).toBe('');
    expect(result.isThinkingActive).toBe(false);
  });

  it('supports alternative tags such as <thought> and <reasoning>', () => {
    const raw = `<thought>Internal deliberation</thought>Final answer`;
    const result = extractThinkingAndContent(raw);
    expect(result.thinking).toBe('Internal deliberation');
    expect(result.content).toBe('Final answer');
  });
});
