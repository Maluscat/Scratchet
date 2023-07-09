'use strict';
class CanvasSendBuffer {
  /**
   * A buffer collecting the drawn positions
   * and sending them to the server on {@link sendPositions} call.
   * @type { Array<number> }
   */
  sendBuffer = new Array();
  /**
   * A buffer collecting the same drawn positions as {@link sendBuffer}
   * but which is added to the client pos buffer on send.
   * @type { Array<number> }
   */
  liveClientBuffer = new Array();

  activeIntervals = new Set();

  sendReady = false;
  willSendCompleteMetaData = true;

  room;

  /** @param { ScratchetCanvas } room */
  constructor(room) {
    this.room = room;

    this.sendPositions = this.sendPositions.bind(this);
    this.sendCompleteMetaDataNextTime = this.sendCompleteMetaDataNextTime.bind(this);
  }


  // ---- Timings ----
  activateTimers() {
    this.activeIntervals.add(
      setInterval(this.sendPositions, Global.SEND_INTERVAL));
    this.activeIntervals.add(
      setInterval(this.sendCompleteMetaDataNextTime, SEND_FULL_METADATA_INTERVAL));
  }
  clearTimers() {
    for (const intervalID of this.activeIntervals) {
      clearInterval(intervalID);
    }
    this.activeIntervals.clear();
  }

  // ---- Send buffer adding ----
  addToSendBufferBrush(posX, posY) {
    this.#ensureSendBufferInitialization(0);
    this.#addToSendBufferAndLiveBufferBrush(posX, posY);
    this.sendReady = true;
  }
  addToSendBufferErase(posX, posY) {
    this.#ensureSendBufferInitialization(Global.MODE.ERASE);
    this.sendBuffer.push(posX, posY);
    this.sendReady = true;
  }

  #addToSendBufferAndLiveBufferBrush(posX, posY) {
    this.liveClientBuffer.push(posX, posY);
    this.sendBuffer.push(posX, posY);
  }


  // ---- Send buffer helpers ----
  #ensureSendBufferInitialization(mode) {
    const currentMode = this.getBufferMode();
    if (mode === currentMode || mode >= 0 && currentMode >= 0) return;
    this.sendPositions();

    this.initializeSendBuffer(mode);
  }

  initializeSendBuffer(mode) {
    switch (mode) {
      case Global.MODE.ERASE: {
        this.initializeSendBufferErase();
        break;
      }
      default: {
        this.initializeSendBufferBrush();
        break;
      }
    }
  }

  // ---- Send buffer initialization ----
  initializeSendBufferBrush() {
    const hue = this.room.tools.brush.hue;
    const width = this.room.tools.brush.width;
    const flag = this.getBrushModeFlag(hue, width);

    this.sendBuffer = [this.room.roomCode, flag];
    this.liveClientBuffer = [hue, width, flag];

    if ((flag & META_FLAGS.LAST_HUE) === 0) {
      this.lastHue = hue;
      this.sendBuffer.push(this.lastHue);
    }
    if ((flag & META_FLAGS.LAST_WIDTH) === 0) {
      this.lastWidth = width;
      this.sendBuffer.push(this.lastWidth);
    }
  }
  initializeSendBufferErase() {
    this.sendBuffer = [this.room.roomCode, Global.MODE.ERASE, this.room.tools.eraser.width];
  }

  resetSendBuffer() {
    this.sendReady = false;

    const mode = this.getBufferMode();
    const lastPos = [
      this.liveClientBuffer.at(-2),
      this.liveClientBuffer.at(-1),
    ];
    this.initializeSendBuffer(mode);

    if (mode >= 0) {
      this.#addToSendBufferAndLiveBufferBrush(...lastPos);
    }
  }
  /**
   * Update the {@link sendBuffer} metadata in place
   * with the ASSUMPTION that the buffer is in its initialized state
   * (Thus, also {@link sendReady} = false).
   */
  updateInitializedSendBufferMeta() {
    const mode = this.getBufferMode();
    if (mode === Global.MODE.ERASE) {
      this.sendBuffer[2] = this.room.tools.eraser.width;
    } else if (mode !== this.getBrushModeFlag(this.room.tools.brush.hue, this.room.tools.brush.width)) {
      const lastPos = [
        this.liveClientBuffer[META_LEN.BRUSH],
        this.liveClientBuffer[META_LEN.BRUSH + 1]
      ];
      this.initializeSendBuffer(mode);
      this.#addToSendBufferAndLiveBufferBrush(...lastPos);
    }
  }

  // ---- Send handling ----
  sendPositions() {
    if (this.sendBuffer.length === 0) return;
    if (this.sendReady) {
      const mode = this.getBufferMode();

      const posData = new Int16Array(this.sendBuffer);
      sock.send(posData.buffer);

      if (mode >= 0) {
        this.room.addClientDataToBuffer(
          new Int16Array(this.liveClientBuffer), this.room.ownUser);
        // posBufferServer needs to be checked due to asynchronities
        // between willSendCompleteMetaData and sendPositions
        // And to ensure that it only resets on normal mode
        if (this.willSendCompleteMetaData && mode === 0) {
          this.willSendCompleteMetaData = false;
        }
      }
      this.resetSendBuffer();
    } else {
      this.updateInitializedSendBufferMeta();
    }
  }

  sendPositionsIfMetaHasChanged() {
    if (this.getBufferMode() === Global.MODE.ERASE
          && this.room.tools.eraser.width !== getClientMetaWidth(this.sendBuffer, EXTRA_META_LEN_SEND)
        || (this.getBufferMode() >= 0
          && this.room.tools.brush.width !== getClientMetaWidth(this.liveClientBuffer)
          || this.room.tools.brush.hue !== getClientMetaHue(this.liveClientBuffer))) {
      this.sendPositions();
    }
  }

  sendCompleteMetaDataNextTime() {
    this.willSendCompleteMetaData = true;
  }

  // ---- Helper functions ----
  getBrushModeFlag(hue, width) {
    let flag = 0;
    if (!this.willSendCompleteMetaData && getClientMetaHue(this.liveClientBuffer) === hue) {
      flag |= META_FLAGS.LAST_HUE;
    }
    if (!this.willSendCompleteMetaData && getClientMetaWidth(this.liveClientBuffer) === width) {
      flag |= META_FLAGS.LAST_WIDTH;
    }
    return flag;
  }

  getBufferMode() {
    return getPendingServerMetaMode(this.sendBuffer);
  }
}
