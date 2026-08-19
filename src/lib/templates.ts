import type { PromptTemplate } from '../types';

const STORAGE_KEY = 'nexus_custom_templates';

export const PRESET_TEMPLATES: PromptTemplate[] = [
  {
    id: 'general',
    name: 'General Assistant',
    prompt: 'You are a helpful, concise assistant. Give clear, direct answers and avoid unnecessary filler.',
    icon: '💬',
  },
  {
    id: 'coder',
    name: 'Code Helper',
    prompt:
      'You are an expert programmer. Help with debugging, code review, and implementation. Always explain your reasoning. When writing code, prefer clean, readable solutions and mention relevant edge cases.',
    icon: '💻',
  },
  {
    id: 'creative',
    name: 'Creative Writer',
    prompt:
      'You are a creative writing assistant. Help with storytelling, prose, poetry, and creative brainstorming. Use vivid language and varied sentence structure. Be imaginative while respecting the user\'s tone and style preferences.',
    icon: '✍️',
  },
  {
    id: 'analyst',
    name: 'Data Analyst',
    prompt:
      'You are a data analyst. Help interpret data, suggest analyses, write queries (SQL, Python pandas), and create visualizations. Be precise with numbers and always cite your reasoning.',
    icon: '📊',
  },
  {
    id: 'translator',
    name: 'Translator',
    prompt:
      'You are a professional translator. Translate text accurately while preserving tone, idioms, and cultural context. When ambiguous, note alternative translations and explain your choice.',
    icon: '🌐',
  },
  {
    id: 'teacher',
    name: 'Teacher',
    prompt:
      'You are a patient teacher. Explain concepts step-by-step, adapt to the learner\'s level, use analogies and examples, and check for understanding. Encourage questions.',
    icon: '📚',
  },
  {
    id: 'concise',
    name: 'Ultra Concise',
    prompt: 'Reply in 1-2 sentences maximum. No greetings, no filler, no explanations unless asked.',
    icon: '⚡',
  },
  {
    id: 'brainstorm',
    name: 'Brainstorm',
    prompt:
      'You are a brainstorming partner. Generate diverse, creative ideas without judgment. Build on the user\'s ideas, suggest unconventional angles, and organize thoughts into categories.',
    icon: '🧠',
  },
];

export function getCustomTemplates(): PromptTemplate[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveCustomTemplate(template: PromptTemplate): void {
  const all = getCustomTemplates();
  const idx = all.findIndex((t) => t.id === template.id);
  if (idx >= 0) all[idx] = template;
  else all.push(template);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

export function deleteCustomTemplate(id: string): void {
  const all = getCustomTemplates().filter((t) => t.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

export function exportTemplates(): string {
  const custom = getCustomTemplates();
  return JSON.stringify(custom, null, 2);
}

export function importTemplates(json: string): number {
  const parsed = JSON.parse(json);
  if (!Array.isArray(parsed)) throw new Error('Expected a JSON array of templates');
  const valid = parsed.filter(
    (t): t is PromptTemplate =>
      t &&
      typeof t.id === 'string' &&
      typeof t.name === 'string' &&
      typeof t.prompt === 'string' &&
      t.name.length > 0 &&
      t.prompt.length > 0
  );
  if (valid.length === 0) throw new Error('No valid templates found in file');
  let imported = 0;
  for (const t of valid) {
    const existing = getCustomTemplates().find((e) => e.id === t.id);
    if (!existing) {
      saveCustomTemplate({ ...t, id: `imported_${Date.now()}_${Math.random().toString(36).slice(2, 6)}` });
      imported++;
    }
  }
  return imported;
}
