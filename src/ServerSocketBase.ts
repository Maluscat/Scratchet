import { SocketBase } from 'SocketBase';

export class ServerSocketBase extends SocketBase {
  /** Counts the first two pings to coordinate the timings setup. */
  #pingSetup = 0;
  #lastPingTimestamp = 0;
  medianPingInterval = 0;

  _handleReceivedPing() {
    this.sendPing();

    const currentTime = new Date().getTime();
    this.#lastPingTimestamp = currentTime;

    if (!this.isTimedOut) {
      const timeElapsed = new Date().setTime(currentTime - this.#lastPingTimestamp);
      this.#setMedianInterval(timeElapsed);
    }
    this._addPingTimeout(this.medianPingInterval * 1.2);
    super._handleReceivedPing();
  }

  #setMedianInterval(timeElapsed: number) {
    if (this.#pingSetup <= 1) {
      if (this.#pingSetup === 1) {
        this.medianPingInterval = timeElapsed;
      }
      this.#pingSetup++;
    } else {
      this.medianPingInterval = (this.medianPingInterval * 4 + timeElapsed * 1) / 5;
    }
  }
}
