class EraseBuffer extends SendBuffer {
  #nextWidth;

  constructor(...args) {
    super(...args);
    this.buffer = [ Global.MODE.ERASE ];
  }

  reset() {
    this.buffer.splice(1);
    if (this.#nextWidth) {
      this.buffer[1] = this.#nextWidth;
      this.#nextWidth = null;
    }
  }
  update() {
    this.ready = false;
    this.reset();
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
