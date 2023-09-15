import { SEND_INTERVAL } from 'Global';

// This is just an estimated good upper limit
const UPPER_RATE_LIMIT_PER_SECOND = Math.floor((1000 / SEND_INTERVAL) * 2);

const TEST_INTERVAL = 250;

// This interval defines the decrement amount and thus the test threshold
// With >1000 ms there is a bit more room for fluctuations without hurting the rate in the long run
const LIMIT_INTERVAL = 5000;
const RATE_LIMIT_PER_INTERVAL = Math.floor(UPPER_RATE_LIMIT_PER_SECOND * (LIMIT_INTERVAL / 1000));
const DECREMENT_PER_INTERVAL = Math.floor(RATE_LIMIT_PER_INTERVAL * 0.8);

/**
 * This is a rate limiter, intended to be instantiated per user.
 * It works as follows:
 * - The rate counter can be incremented unconditionally.
 * - Every n milliseconds, the counter is decremented by A BIT LESS than a threshold.
 * - If the counter exceeds the threshold (checked regularly), `isLimited` is set to true.
 * - `isLimited` is only reset to false if the counter is completely 0
 */
export class SocketRateHandler {
  #rateCounter: number = 0;
  isLimited = false;

  constructor() {
    setInterval(this.#testRateLimit.bind(this), TEST_INTERVAL);
    setInterval(this.#bulkDecrement.bind(this), LIMIT_INTERVAL);
  }

  increment() {
    this.#rateCounter++;
  }

  getCount() {
    return this.#rateCounter;
  }

  #testRateLimit() {
    if (this.#rateCounter > RATE_LIMIT_PER_INTERVAL) {
      this.isLimited = true;
    } else if (this.isLimited === true && this.#rateCounter === 0) {
      this.isLimited = false;
    }
  }
  #bulkDecrement() {
    this.#rateCounter = Math.max(0, this.#rateCounter - DECREMENT_PER_INTERVAL);
  }
}
