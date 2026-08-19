export const TAG_PRESETS = [
  { name: 'Work', color: '#3b82f6' },
  { name: 'Personal', color: '#10b981' },
  { name: 'Urgent', color: '#ef4444' },
  { name: 'Ideas', color: '#f59e0b' },
  { name: 'Code', color: '#8b5cf6' },
  { name: 'Research', color: '#06b6d4' },
  { name: 'Archived', color: '#6b7280' },
  { name: 'Bug', color: '#ec4899' },
] as const;

export function getTagColor(tagName: string): string {
  const preset = TAG_PRESETS.find((t) => t.name.toLowerCase() === tagName.toLowerCase());
  if (preset) return preset.color;
  let hash = 0;
  for (let i = 0; i < tagName.length; i++) {
    hash = tagName.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 65%, 55%)`;
}
