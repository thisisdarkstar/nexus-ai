import { marked } from 'marked';
import DOMPurify from 'dompurify';
import hljs from 'highlight.js';

marked.use({
  breaks: true,
  renderer: {
    code({ text, lang }) {
      const validLang = lang && hljs.getLanguage(lang) ? lang : null;
      const highlighted = validLang
        ? hljs.highlight(text, { language: validLang }).value
        : hljs.highlightAuto(text).value;
      return `<pre><code class="hljs${validLang ? ` language-${validLang}` : ''}">${highlighted}</code></pre>`;
    }
  }
});

export function renderMarkdown(text) {
  return DOMPurify.sanitize(marked.parse(text));
}
