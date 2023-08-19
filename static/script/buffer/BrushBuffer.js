class BrushBuffer extends SendBuffer {
  /**
   * A buffer collecting the same drawn positions as {@link buffer}
   * but which is added to the client pos buffer on send.
   * @type { number[] }
   */
  liveClientBuffer = [];

  /** @type { (Int16Array) => void } */
  sendClientFn;

  willSendCompleteMetaData = true;
  #nextHue;
  #nextWidth;


  constructor(sendClientFn, ...args) {
    super(...args);
    this.sendClientFn = sendClientFn;
    this.buffer = [ 0 ];

    this.sendCompleteMetaDataNextTime = this.sendCompleteMetaDataNextTime.bind(this);
  }


  // ---- Buffer operations ----
  reset() {
    const hue = this.#nextHue ?? this.liveClientBuffer[0];
    const width = this.#nextWidth ?? this.liveClientBuffer[1];

    const flag = this.getNextFlag(hue, width);

    this.buffer.splice(1);
    this.liveClientBuffer.splice(META_LEN.BRUSH);

    this.buffer[0] = flag;

    if ((flag & META_FLAGS.LAST_HUE) === 0) {
      this.buffer.push(hue);
    }
    if ((flag & META_FLAGS.LAST_WIDTH) === 0) {
      this.buffer.push(width);
    }

    this.liveClientBuffer[0] = hue;
    this.liveClientBuffer[1] = width;
    this.liveClientBuffer[2] = flag;

    this.#nextHue = null;
    this.#nextWidth = null;
  }

  update() {
    if (this.ready) {
      this.ready = false;
      this.sendClientFn(new Int16Array(this.liveClientBuffer));
      this.resetCompleteMetadataIfSatisfied();
    }

    if (this.liveClientBuffer.length > META_LEN.BRUSH) {
      const lastPos = [
        this.liveClientBuffer.at(-2),
        this.liveClientBuffer.at(-1),
      ];
      this.reset();
      this.#addPos(...lastPos);
    } else {
      this.reset();
    }
  }

  // ---- Metadata handlers ----
  updateHue(hue) {
    if (hue !== this.liveClientBuffer[0]) {
      this.#nextHue = hue;
      this.sendOrUpdate();
    }
  }
  updateWidth(width) {
    if (width !== this.liveClientBuffer[1]) {
      this.#nextWidth = width;
      this.sendOrUpdate();
    }
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

  resetCompleteMetadataIfSatisfied() {
    if (this.willSendCompleteMetaData && this.getMode() === 0) {
      this.willSendCompleteMetaData = false;
    }
  }
  sendCompleteMetaDataNextTime() {
    this.willSendCompleteMetaData = true;
  }
}
