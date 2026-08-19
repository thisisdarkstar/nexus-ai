const HTML_TAG_RE = /<[^>]*>/g;

export function sanitizePlainText(input: string): string {
  return input.replace(HTML_TAG_RE, '').trim();
}

export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function truncate(input: string, maxLen: number): string {
  if (input.length <= maxLen) return input;
  return input.slice(0, maxLen - 1) + '…';
}
