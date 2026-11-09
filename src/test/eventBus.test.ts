import { describe, it, expect, vi, beforeEach } from 'vitest';
import { eventBus } from '../core/bus/EventBus';

describe('Typed EventBus Engine', () => {
  beforeEach(() => {
    eventBus.clear();
  });

  it('delivers typed payload to subscribers', () => {
    const callback = vi.fn();
    eventBus.subscribe('finding:added', callback);

    const dummyFinding = {
      id: 'f-101',
      title: 'SQL Injection in /api/v1/search',
      severity: 'critical' as const,
      description: 'Test description',
      remediation: 'Use parameterized queries',
    };

    eventBus.publish('finding:added', { finding: dummyFinding, projectId: 'proj-1' });

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith({ finding: dummyFinding, projectId: 'proj-1' });
  });

  it('unsubscribes cleanly when invoking returned unsubscribe function', () => {
    const callback = vi.fn();
    const unsubscribe = eventBus.subscribe('workbench:switch-tab', callback);

    eventBus.publish('workbench:switch-tab', { tab: 'http_studio' });
    expect(callback).toHaveBeenCalledTimes(1);

    unsubscribe();

    eventBus.publish('workbench:switch-tab', { tab: 'recon' });
    expect(callback).toHaveBeenCalledTimes(1); // not called again
  });

  it('isolates errors inside subscribers without breaking subsequent subscribers', () => {
    const faultySubscriber = vi.fn(() => {
      throw new Error('Subscriber crashed');
    });
    const healthySubscriber = vi.fn();

    eventBus.subscribe('scope:deleted', faultySubscriber);
    eventBus.subscribe('scope:deleted', healthySubscriber);

    expect(() => {
      eventBus.publish('scope:deleted', { id: 'scope-99' });
    }).not.toThrow();

    expect(faultySubscriber).toHaveBeenCalled();
    expect(healthySubscriber).toHaveBeenCalledWith({ id: 'scope-99' });
  });
});

