class ClientSocketBase {
  static pingPayload = Uint8Array.of(0);

  socket;

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

  constructor(socket, {
    pingInterval = 0
  }) {
    this.sendPing = this.sendPing.bind(this);

    this.socket = socket;
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
