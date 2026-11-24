import { beforeEach, describe, expect, it, vi } from 'vitest';
import { eventBus } from '../core/bus/EventBus';
import {
  DEFAULT_PROJECT_ID,
  setActiveProjectId,
} from '../core/storage/projectStorage';
import { workbenchBridge } from '../lib/security/workbenchBridge';

describe('WorkbenchBridge typed events', () => {
  beforeEach(() => {
    localStorage.clear();
    eventBus.clear();
    setActiveProjectId(DEFAULT_PROJECT_ID);
  });

  it('publishes routing events to both typed subscribers and legacy listeners', () => {
    const typed = vi.fn();
    const legacy = vi.fn();
    const unsubscribe = eventBus.subscribe('open-security', typed);
    window.addEventListener('nexus:open-security', legacy);

    workbenchBridge.switchTab('reports', { code: 'console.log(1)' });

    expect(typed).toHaveBeenCalledWith({ tab: 'reports', code: 'console.log(1)' });
    expect(legacy).toHaveBeenCalled();

    unsubscribe();
    window.removeEventListener('nexus:open-security', legacy);
  });

  it('normalizes raw HTTP handoff payloads', () => {
    const typed = vi.fn();
    const unsubscribe = eventBus.subscribe('workbench:load-http', typed);

    workbenchBridge.loadHttp('GET / HTTP/1.1\nHost: example.test');

    expect(typed).toHaveBeenCalledWith({ rawHttp: 'GET / HTTP/1.1\nHost: example.test' });
    unsubscribe();
  });
});
