import * as Meta from '~/constants/meta.js';
import { SendBuffer } from '~/buffer/SendBuffer.js';

export class EraseBuffer extends SendBuffer {
  #nextWidth;

  constructor(...args) {
    super(...args);
    this.buffer = [ Meta.MODE.ERASE ];
  }

  reset() {
    this.buffer.splice(2);
    if (this.#nextWidth) {
      this.buffer[1] = this.#nextWidth;
      this.#nextWidth = null;
    }
  }

  updateWidth(width) {
    if (width !== this.buffer[1]) {
      this.#nextWidth = width;
      this.sendOrUpdate();
    }
  }

  add(posX, posY) {
    this.buffer.push(posX, posY);
    this.ready = true;
  }
}
