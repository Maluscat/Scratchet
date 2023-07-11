class BrushBuffer extends SendBuffer {
  /**
   * A buffer collecting the same drawn positions as {@link buffer}
   * but which is added to the client pos buffer on send.
   * @type { number[] }
   */
  liveClientBuffer = [];

  willSendCompleteMetaData = true;


  constructor(room) {
    super(room);
    this.sendCompleteMetaDataNextTime = this.sendCompleteMetaDataNextTime.bind(this);
  }


  // ---- Buffer operations ----
  reset() {
    const hue = this.room.tools.brush.hue;
    const width = this.room.tools.brush.width;
    const flag = this.getNextFlag(hue, width);

    this.buffer.splice(1);
    this.liveClientBuffer.splice(3);

    // TODO Prepend the room code dynamically to the ArrayBuffer on send
    this.buffer[0] = this.room.roomCode;
    this.buffer.push(flag);

    if ((flag & META_FLAGS.LAST_HUE) === 0) {
      this.buffer.push(hue);
    }
    if ((flag & META_FLAGS.LAST_WIDTH) === 0) {
      this.buffer.push(width);
    }

    this.liveClientBuffer[0] = hue;
    this.liveClientBuffer[1] = width;
    this.liveClientBuffer[2] = flag;
  }
  // TODO this is still not perfect, especially paired with the EraseBuffer
  resetMeta() {
    if (this.getMode() !== this.getNextFlag(this.room.tools.brush.hue, this.room.tools.brush.width)) {
      this.reset();
    }
  }

  update() {
    this.ready = false;
    this.sendClientBuffer();

    const lastPos = [
      this.liveClientBuffer.at(-2),
      this.liveClientBuffer.at(-1),
    ];
    this.reset();
    this.#addPos(...lastPos);
  }

  sendClientBuffer() {
    // TODO perhaps outsource this to the actual room / intermediate helper function
    const clientArr = new Int16Array(this.liveClientBuffer);
    this.room.addClientDataToBuffer(clientArr, this.room.ownUser);

    if (this.willSendCompleteMetaData && this.getMode() === 0) {
      this.willSendCompleteMetaData = false;
    }
  }

  didMetaChange() {
    return this.room.tools.brush.width !== getClientMetaWidth(this.liveClientBuffer)
        || this.room.tools.brush.hue !== getClientMetaHue(this.liveClientBuffer);
  }

  // ---- Adding to the buffer ----
  add(posX, posY) {
    this.#addPos(posX, posY);
    this.ready = true;
  }

  #addPos(posX, posY) {
    this.liveClientBuffer.push(posX, posY);
    this.buffer.push(posX, posY);
  }

  // ---- Helper functions ----
  getNextFlag(hue, width) {
    let flag = 0;
    if (!this.willSendCompleteMetaData && getClientMetaHue(this.liveClientBuffer) === hue) {
      flag |= META_FLAGS.LAST_HUE;
    }
    if (!this.willSendCompleteMetaData && getClientMetaWidth(this.liveClientBuffer) === width) {
      flag |= META_FLAGS.LAST_WIDTH;
    }
    return flag;
  }

  sendCompleteMetaDataNextTime() {
    this.willSendCompleteMetaData = true;
  }
}
