class EraseBuffer extends SendBuffer {
  reset() {
    this.buffer.splice(2);
    this.buffer[0] = this.room.roomCode;
    this.buffer[1] = Global.MODE.ERASE;
    this.buffer[2] = this.room.tools.eraser.width;
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
