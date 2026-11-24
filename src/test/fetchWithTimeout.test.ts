import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchWithTimeout } from '../lib/providers/fetchWithTimeout';

describe('fetchWithTimeout', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('aborts a request that exceeds the timeout', async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'));
          });
        })
      )
    );

    const pending = fetchWithTimeout('http://localhost:9999/models', {}, 25);
    const assertion = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    await vi.advanceTimersByTimeAsync(30);
    await assertion;
  });

  it('clears its timer and resolves a fast response', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}')));
    const response = await fetchWithTimeout('http://localhost:9999/models');
    expect(response.ok).toBe(true);
  });
});
