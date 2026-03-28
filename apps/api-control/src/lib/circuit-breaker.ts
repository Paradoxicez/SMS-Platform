/**
 * T280: Simple circuit breaker
 *
 * Opens the circuit after `threshold` consecutive failures.
 * After `resetTimeout` ms, enters half-open state and allows one probe request.
 */
export class CircuitBreaker {
  private state: "closed" | "open" | "half-open" = "closed";
  private failureCount = 0;
  private lastFailureTime = 0;

  constructor(
    private name: string,
    private threshold: number = 5,
    private resetTimeout: number = 30000,
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === "open") {
      // Check if reset timeout has elapsed
      if (Date.now() - this.lastFailureTime >= this.resetTimeout) {
        this.state = "half-open";
      } else {
        throw new Error(`Circuit breaker '${this.name}' is OPEN`);
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;
    this.state = "closed";
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.threshold) {
      this.state = "open";
      console.log(
        JSON.stringify({
          level: "warn",
          service: "circuit-breaker",
          message: `Circuit '${this.name}' opened after ${this.failureCount} failures`,
        }),
      );
    }
  }

  getState(): "closed" | "open" | "half-open" {
    // Re-check if we should transition from open to half-open
    if (
      this.state === "open" &&
      Date.now() - this.lastFailureTime >= this.resetTimeout
    ) {
      this.state = "half-open";
    }
    return this.state;
  }
}
