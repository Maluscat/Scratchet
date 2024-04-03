import { SocketBase } from 'SocketBase';

export class ServerSocketBase extends SocketBase {
  /** Counts the first two pings to coordinate the timings setup. */
  #pingSetup = 0;
  #lastPingTimestamp = 0;
  medianPingInterval = 0;

  _handleReceivedPing() {
    const currentTime = new Date().getTime();

    if (this.isTimedOut) {
      this.#resetTimings();
    } else {
      const timeElapsed = new Date().setTime(currentTime - this.#lastPingTimestamp);
      this.#setTimings(timeElapsed);
    }

    this.#lastPingTimestamp = currentTime;
    this.sendPing();
    super._handleReceivedPing();
  }

  #setTimings(timeElapsed: number) {
    if (this.#pingSetup <= 1) {
      if (this.#pingSetup === 1) {
        this.medianPingInterval = timeElapsed;
      }
      this.#pingSetup++;
    } else {
      this.medianPingInterval = (this.medianPingInterval * 4 + timeElapsed * 1) / 5;
      this._addPingTimeout(this.medianPingInterval * 1.2);
    }
  }

  #resetTimings() {
    this.#pingSetup = 0;
  }
}
