class UndoRedoBufferBase extends SendBuffer {
  constructor(mode, ...args) {
    super(...args);
    this.buffer = [ mode ];
  }

  reset() {
    this.buffer.splice(1);
    this.buffer[1] = 0;
  }

  add(count) {
    this.buffer[1] += count;
    if (this.buffer[1] > 0) {
      this.ready = true;
    }
  }
}
