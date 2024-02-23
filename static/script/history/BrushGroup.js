class BrushGroup {
  #redoBuffer = [];
  #length;

  #userBuffer;

  constructor(userBuffer, length) {
    this.#length = length;
    this.#userBuffer = userBuffer;
  }

  undo(posHandler) {
    for (let i = 0; i < this.#length; i++) {
      const posDataWrapper = this.#userBuffer.pop();
      this.#redoBuffer.push(posDataWrapper);
      posHandler.deleteFromBuffer(posDataWrapper);
    }
  }
  redo(posHandler) {
    for (let i = 0; i < this.#length; i++) {
      const posDataWrapper = this.#redoBuffer.pop();
      this.#userBuffer.push(posDataWrapper);
      posHandler.addToBuffer(posDataWrapper);
    }
  }
}
