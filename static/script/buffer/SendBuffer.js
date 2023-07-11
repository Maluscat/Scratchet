class SendBuffer {
  /**
   * A buffer collecting data, ready to be sent to the server.
   * @type { number[] }
   */
  buffer = [];

  /** @type { ScratchetCanvas } */
  room;

  ready = false;

  /** @param { ScratchetCanvas } room */
  constructor(room) {
    this.room = room;
  }

  // ---- ABSTRACT ----
  reset() {}
  resetMeta() {}
  update() {}
  add(...data) {}

  didMetaChange() {
    return false;
  }

  // ---- Utility functions ----
  getMode() {
    return getPendingServerMetaMode(this.buffer);
  }
}
