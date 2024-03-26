import { SocketBase } from '~/socket/SocketBase.js';

export class ClientSocketBase extends SocketBase {
  #pingIntervalHasChanged = false;
  #pingIntervalID;
  #pingInterval;
  /**
   * Amount of time in milliseconds that is waited for a ping response.
   * If no response comes within this window, a `timeout` event will be invoked.
   */
  pingTimeout;

  /**
   * Interval in milliseconds in which to send a ping.
   * Can be changed on the fly, in which case the interval becomes
   * active once the current ping has fired.
   *
   * Set to 0 to disable.
   * @default 0
   * @type { number }
   */
  get pingInterval() {
    return this.#pingInterval;
  }
  set pingInterval(val) {
    const currentVal = this.#pingInterval;
    if (val !== currentVal) {
      this.#pingIntervalHasChanged = true;
      this.#pingInterval = val;
      if (currentVal === 0) {
        this.#restartPingInterval();
      }
    }
  }

  constructor(socket, {
    pingInterval = 0,
    pingTimeout = 3000
  }) {
    super(socket);
    this.sendPing = this.sendPing.bind(this);

    this.pingTimeout = pingTimeout;
    this.pingInterval = pingInterval;
    this.#restartPingInterval();
  }

  send(message) {
    this.socket.send(message);
  }
  sendEvent(eventType, data = {}) {
    data.evt = eventType;
    this.send(JSON.stringify(data));
  }
  sendPing() {
    super.sendPing();
    if (this.#pingIntervalHasChanged) {
      this.#restartPingInterval();
    }
    this._addPingTimeout(this.pingTimeout);
  }

  _handleReceivedPing() {
    super._handleReceivedPing();
    this._clearPingTimeout();
  }

  // ---- Helper functions ----
  #restartPingInterval() {
    if (this.#pingIntervalID != null) {
      clearTimeout(this.#pingIntervalID);
    }
    if (this.#pingInterval > 0) {
      this.#pingIntervalID = setInterval(this.sendPing, this.#pingInterval);
    }
    this.#pingIntervalHasChanged = false;
  }
}
