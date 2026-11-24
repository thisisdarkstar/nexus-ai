import { describe, it, expect, beforeEach } from 'vitest';
import {
  DEFAULT_PROJECT_ID,
  getActiveProjectId,
  projectLocalStorage,
  removeProjectStorage,
  setActiveProjectId,
} from '../core/storage/projectStorage';

describe('Project-scoped localStorage', () => {
  beforeEach(() => {
    window.localStorage.clear();
    setActiveProjectId(DEFAULT_PROJECT_ID);
  });

  it('keeps legacy keys for the default engagement', () => {
    projectLocalStorage.setItem('nexus_security_scope', '[]');
    expect(window.localStorage.getItem('nexus_security_scope')).toBe('[]');
  });

  it('namespaces keys for non-default engagements and isolates their values', () => {
    projectLocalStorage.setItem('nexus_security_scope', '[default]');
    setActiveProjectId('engagement-b');
    projectLocalStorage.setItem('nexus_security_scope', '[bravo]');

    expect(window.localStorage.getItem('nexus:engagement-b:nexus_security_scope')).toBe('[bravo]');
    expect(projectLocalStorage.getItem('nexus_security_scope')).toBe('[bravo]');

    setActiveProjectId(DEFAULT_PROJECT_ID);
    expect(projectLocalStorage.getItem('nexus_security_scope')).toBe('[default]');
  });

  it('falls back to the default engagement for empty ids', () => {
    setActiveProjectId('   ');
    expect(getActiveProjectId()).toBe(DEFAULT_PROJECT_ID);
  });

  it('removes only the target engagement keys', () => {
    setActiveProjectId('engagement-b');
    projectLocalStorage.setItem('nexus_security_report', '{}');
    setActiveProjectId(DEFAULT_PROJECT_ID);
    projectLocalStorage.setItem('nexus_security_report', '{}');

    removeProjectStorage('engagement-b');
    expect(window.localStorage.getItem('nexus:engagement-b:nexus_security_report')).toBeNull();
    expect(window.localStorage.getItem('nexus_security_report')).toBe('{}');
  });
});
