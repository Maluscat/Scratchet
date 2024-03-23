import * as Meta from '~/Meta.js';
import { SendBuffer } from '~/buffer/SendBuffer.js';

export class BrushBuffer extends SendBuffer {
  /**
   * A buffer collecting the same drawn positions as {@link buffer}
   * but which is added to the client pos buffer on send.
   * @type { number[] }
   */
  liveClientBuffer = [];

  /** @type { (Int16Array) => void } */
  sendClientFn;

  #nextHue;
  #nextWidth;

  constructor(sendClientFn, ...args) {
    super(...args);
    this.sendClientFn = sendClientFn;
    this.buffer = [ 0 ];
  }


  // ---- Buffer operations ----
  reset() {
    const hue = this.#nextHue ?? this.liveClientBuffer[0];
    const width = this.#nextWidth ?? this.liveClientBuffer[1];

    this.buffer.splice(Meta.LEN.BRUSH);
    this.buffer[0] = hue;
    this.buffer[1] = width;

    this.liveClientBuffer.splice(Meta.LEN.BRUSH);
    this.liveClientBuffer[0] = hue;
    this.liveClientBuffer[1] = width;

    this.#nextHue = null;
    this.#nextWidth = null;
  }

  update() {
    if (this.ready) {
      this.ready = false;
      this.sendClientFn(new Int16Array(this.liveClientBuffer));
    }

    if (this.liveClientBuffer.length > Meta.LEN.BRUSH) {
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
}
