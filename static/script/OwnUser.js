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


  // ---- Undo data group capturing ----
  startBrushGroupCapture() {
    this.#startUndoGroupCapture(this.posCache);
  }
  startEraseGroupCapture() {
    this.#startUndoGroupCapture(this.undoEraseQueue);
  }

  #startUndoGroupCapture(buffer) {
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

  // ---- Undo data helpers ----
  getNextUndoGroup() {
    return this.undoData.groups[this.undoData.groupIndex];
  }
}
