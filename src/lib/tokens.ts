export function estimateTokens(text: string): number {
  if (!text) return 0;
  const charCount = text.length;
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(charCount / 4 + wordCount * 0.1));
}
