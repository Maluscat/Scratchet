class SendBuffer {
  /**
   * A buffer collecting data, ready to be sent to the server.
   * @type { number[] }
   */
  buffer = [];

  sendFn;

  ready = false;

  /** @param { () => boolean } sendFn */
  constructor(sendFn) {
    this.sendFn = sendFn;
  }

  // ---- ABSTRACT ----
  reset() {}
  update() {}
  add(...data) {}

  sendOrUpdate() {
    if (!this.sendFn()) {
      this.update();
    }
  }

  // ---- Utility functions ----
  getMode() {
    return getPendingServerMetaMode(this.buffer);
  }
}
