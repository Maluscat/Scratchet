class ClientSocketBase extends WebSocket {
  static pingPayload = Uint8Array.of(0);

  #pingIntervalHasChanged = false;
  #pingIntervalID;
  #pingInterval;

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

  constructor(url, {
    pingInterval = 0
  }) {
    super(url);
    this.sendPing = this.sendPing.bind(this);

    this.pingInterval = pingInterval;
    this.#restartPingInterval();
  }

  sendEvent(eventType, data = {}) {
    data.evt = eventType;
    this.send(JSON.stringify(data));
  }
  send(message) {
    super.send(message);
  }
  sendPing() {
    this.send(ClientSocketBase.pingPayload);
    if (this.#pingIntervalHasChanged) {
      this.#restartPingInterval();
    }
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
