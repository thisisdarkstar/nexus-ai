import type { SecurityEventMap } from './events';

export type EventCallback<T> = (payload: T) => void;

class TypedEventBus {
  private static instance: TypedEventBus;
  private listeners: Map<keyof SecurityEventMap, Set<EventCallback<any>>> = new Map();

  private constructor() {}

  public static getInstance(): TypedEventBus {
    if (!TypedEventBus.instance) {
      TypedEventBus.instance = new TypedEventBus();
    }
    return TypedEventBus.instance;
  }

  /**
   * Subscribe to a typed security event.
   * Returns an unsubscription function.
   */
  public subscribe<K extends keyof SecurityEventMap>(
    event: K,
    callback: EventCallback<SecurityEventMap[K]>
  ): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    return () => {
      this.unsubscribe(event, callback);
    };
  }

  /**
   * Unsubscribe a listener from a typed event.
   */
  public unsubscribe<K extends keyof SecurityEventMap>(
    event: K,
    callback: EventCallback<SecurityEventMap[K]>
  ): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.delete(callback);
      if (handlers.size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  /**
   * Publish a typed event to all registered subscribers.
   */
  public publish<K extends keyof SecurityEventMap>(
    event: K,
    payload: SecurityEventMap[K]
  ): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(payload);
        } catch (err) {
          console.error(`[EventBus] Error executing subscriber for "${String(event)}":`, err);
        }
      });
    }

    // Mirror to window.dispatchEvent for backward compatibility with legacy custom event listeners
    try {
      window.dispatchEvent(
        new CustomEvent(`nexus:${String(event)}`, {
          detail: payload,
        })
      );
    } catch {
      // Browser environment guard
    }
  }

  /**
   * Remove all registered listeners (primarily for testing and resets).
   */
  public clear(): void {
    this.listeners.clear();
  }
}

export const eventBus = TypedEventBus.getInstance();

