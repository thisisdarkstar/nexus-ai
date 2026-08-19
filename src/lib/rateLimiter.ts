export class RateLimiter {
  private lastCall: number = 0;
  private minInterval: number;

  constructor(minIntervalMs: number = 500) {
    this.minInterval = minIntervalMs;
  }

  async throttle(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastCall;
    if (elapsed < this.minInterval) {
      await new Promise((r) => setTimeout(r, this.minInterval - elapsed));
    }
    this.lastCall = Date.now();
  }

  canCall(): boolean {
    return Date.now() - this.lastCall >= this.minInterval;
  }
}
