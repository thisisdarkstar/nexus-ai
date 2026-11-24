/**
 * Project-scoped localStorage facade.
 *
 * The security workbench historically wrote every module's state to a single
 * global localStorage key (e.g. `nexus_security_scope`). That meant switching
 * engagements in the header never actually isolated findings, scope, reports,
 * checklists or recon assets.
 *
 * This facade keeps the legacy keys for the `default` engagement (so existing
 * user data is never lost) and namespaces every other engagement with a
 * `nexus:<projectId>:` prefix.
 */

export const DEFAULT_PROJECT_ID = 'default';

let activeProjectId = DEFAULT_PROJECT_ID;

export function setActiveProjectId(id?: string | null): void {
  activeProjectId = id && id.trim() ? id : DEFAULT_PROJECT_ID;
}

export function getActiveProjectId(): string {
  return activeProjectId;
}

function scopedKey(key: string): string {
  return activeProjectId === DEFAULT_PROJECT_ID
    ? key
    : `nexus:${activeProjectId}:${key}`;
}

export const projectLocalStorage = {
  getItem(key: string): string | null {
    try {
      return window.localStorage.getItem(scopedKey(key));
    } catch {
      return null;
    }
  },

  setItem(key: string, value: string): void {
    try {
      window.localStorage.setItem(scopedKey(key), value);
    } catch {
      // Storage can be unavailable (private mode / quota). The app remains usable in-memory.
    }
  },

  removeItem(key: string): void {
    try {
      window.localStorage.removeItem(scopedKey(key));
    } catch {
      // ignore
    }
  },
};

/** Remove every persisted trace of an engagement (localStorage side). */
export function removeProjectStorage(projectId: string): void {
  try {
    const prefix = `nexus:${projectId}:`;
    const doomed: string[] = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (!key) continue;
      if (key.startsWith(prefix)) doomed.push(key);
      if (projectId === DEFAULT_PROJECT_ID && key.startsWith('nexus_security_')) {
        doomed.push(key);
      }
    }
    doomed.forEach((key) => window.localStorage.removeItem(key));
  } catch {
    // ignore
  }
}
