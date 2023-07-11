class EraseBuffer extends SendBuffer {
  constructor(room) {
    super(room);
    this.buffer = [ Global.MODE.ERASE ];
  }

  reset() {
    this.buffer.splice(1);
    this.buffer[1] = this.room.tools.eraser.width;
  }
  resetMeta() {
    if (this.didMetaChange()) {
      this.reset();
    }
  }
  update() {
    this.ready = false;
    this.reset();
  }

  didMetaChange() {
    return this.room.tools.eraser.width !== getClientMetaWidth(this.buffer, EXTRA_META_LEN_SEND)
  }

  add(posX, posY) {
    this.buffer.push(posX, posY);
    this.ready = true;
  }
}
