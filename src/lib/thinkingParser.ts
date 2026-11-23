export interface ParsedThinkingMessage {
  thinking: string | null;
  content: string;
  isThinkingActive: boolean;
}

/**
 * Extracts internal model reasoning/thinking tokens from raw message text.
 * Handles:
 *  1. Closed tags: <think>...</think>, <thought>...</thought>, <reasoning>...</reasoning>
 *  2. Unclosed/streaming tags: <think>... (active generation)
 *  3. Blockquote reasoning: > *Thinking:*\n> ... (legacy/stored messages)
 */
export function extractThinkingAndContent(rawText: string): ParsedThinkingMessage {
  if (!rawText) {
    return { thinking: null, content: '', isThinkingActive: false };
  }

  // 1. Closed tags: <think>...</think>, <thought>...</thought>, <reasoning>...</reasoning>
  const closedMatch = /<(think|thought|reasoning)>([\s\S]*?)<\/\1>/i.exec(rawText);
  if (closedMatch) {
    const thinking = closedMatch[2].trim();
    const content = rawText.replace(closedMatch[0], '').trim();
    return {
      thinking: thinking.length > 0 ? thinking : null,
      content,
      isThinkingActive: false,
    };
  }

  // 2. Unclosed / streaming tag: <think>... (no closing tag yet)
  const openMatch = /<(think|thought|reasoning)>([\s\S]*)$/i.exec(rawText);
  if (openMatch) {
    const thinking = openMatch[2].trim();
    return {
      thinking: thinking.length > 0 ? thinking : null,
      content: '',
      isThinkingActive: true,
    };
  }

  // 3. Blockquote reasoning from legacy streams: > *Thinking:*\n> ...
  const bqHeaderMatch = /^>\s*\*?(?:Thinking|Thought Process|Thought):?\*?\s*\n/i.exec(rawText);
  if (bqHeaderMatch) {
    const rest = rawText.slice(bqHeaderMatch[0].length);
    const lines = rest.split('\n');
    const thinkingLines: string[] = [];
    let contentIndex = -1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (
        line.startsWith('>') ||
        (line.trim() === '' && i + 1 < lines.length && lines[i + 1].startsWith('>'))
      ) {
        thinkingLines.push(line.replace(/^>\s?/, ''));
      } else {
        contentIndex = i;
        break;
      }
    }

    const thinking = thinkingLines.join('\n').trim();
    const content = contentIndex >= 0 ? lines.slice(contentIndex).join('\n').trim() : '';

    return {
      thinking: thinking.length > 0 ? thinking : null,
      content,
      isThinkingActive: false,
    };
  }

  return { thinking: null, content: rawText, isThinkingActive: false };
}
