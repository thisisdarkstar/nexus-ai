import { marked } from 'marked';
import DOMPurify from 'dompurify';
import hljs from 'highlight.js';

marked.use({
  breaks: true,
  renderer: {
    code({ text, lang }: { text: string; lang?: string }) {
      const validLang = lang && hljs.getLanguage(lang) ? lang : null;
      const highlighted = validLang
        ? hljs.highlight(text, { language: validLang }).value
        : hljs.highlightAuto(text).value;
      return `<pre><code class="hljs${validLang ? ` language-${validLang}` : ''}">${highlighted}</code></pre>`;
    },
  },
});

export function renderMarkdown(text: string): string {
  return DOMPurify.sanitize(marked.parse(text) as string);
}
