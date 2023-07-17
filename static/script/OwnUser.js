'use strict';
class OwnUser extends ScratchetUser {
  undoData = {
    groups: [],
    groupIndex: 0
  };

  /** @type { Array } */
  #captureBuffer;
  /** @type { number } */
  #captureStartLen;


  clearRedoBuffer() {
    this.undoData.groups.splice(this.undoData.groupIndex);
    super.clearRedoBuffer();
  }

  // ---- Undo data grouping ----
  startUndoGroupCapture(buffer) {
    this.#captureBuffer = buffer;
    this.#captureStartLen = buffer.length;
  }
  captureUndoGroup() {
    if (!this.#captureBuffer) return;

    const count = this.#captureBuffer.length - this.#captureStartLen;
    if (count > 0) {
      this.undoData.groups.push(count);
      this.undoData.groupIndex++;
    }
    this.#captureBuffer = null;
    this.#captureStartLen = null;
  }

  getNextUndoGroup() {
    return this.undoData.groups[this.undoData.groupIndex];
  }
}
