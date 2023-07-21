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


  // ---- Super shims ----
  undo(room) {
    if (this.undoData.groupIndex > 0) {
      this.undoData.groupIndex--;
      const count = this.getNextUndoGroup();
      super.undo(room, count);
      return count;
    }
    return 0;
  }
  redo(room) {
    if (this.undoData.groupIndex < this.undoData.groups.length) {
      const count = this.getNextUndoGroup();
      this.undoData.groupIndex++;
      super.redo(room, count);
      return count;
    }
    return 0;
  }

  clearRedoBuffer() {
    this.clearUndoDataAtCurrentIndex();
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
    this.clearRedoBuffer();
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

    this.clearUndoGroupCaptureData();
  }

  clearUndoGroupCaptureData() {
    this.#captureBuffer = null;
    this.#captureStartLen = null;
  }

  // ---- Undo data helpers ----
  getNextUndoGroup() {
    return this.undoData.groups[this.undoData.groupIndex];
  }

  clearUndoDataAtCurrentIndex() {
    this.undoData.groups.splice(this.undoData.groupIndex);
  }
}
