'use strict';
class HistoryHandler {
  /** @type { Array<BrushGroup | EraserGroup> } */
  history = [];
  historyIndex = 0;

  #brushBuffer;
  #brushStartingLen;

  /** @type { UndoEraseInfo[] } */
  #eraseData = [];

  constructor(brushBuffer) {
    this.#brushBuffer = brushBuffer;
    this.#updateBrushLen();
  }

  // ---- Undo/Redo ----
  undo(count, posHandler) {
    this.addGroup();
    for (let i = 0; i < count; i++) {
      if (this.historyIndex > 0) {
        const group = this.history[this.historyIndex - 1];
        group.undo(posHandler);
        this.historyIndex--;
      }
    }
    this.#updateBrushLen();
  }
  redo(count, posHandler) {
    this.addGroup();
    for (let i = 0; i < count; i++) {
      if (this.historyIndex < this.history.length) {
        const group = this.history[this.historyIndex];
        group.redo(posHandler);
        this.historyIndex++;
      }
    }
    this.#updateBrushLen();
  }

  // ---- Group handling ----
  /** @param { UndoEraseInfo[] } data */
  addEraseData(data) {
    this.clear();
    this.#eraseData.push(...data);
  }

  addGroup() {
    this.#addBrushGroup();
    this.#addEraserGroup();
  }
  #addBrushGroup() {
    const deltaLen = this.#brushBuffer.length - this.#brushStartingLen;
    if (deltaLen > 0) {
      this.#addToHistory(new BrushGroup(this.#brushBuffer, deltaLen));
      this.#updateBrushLen();
    }
  }
  #addEraserGroup() {
    if (this.#eraseData.length > 0) {
      this.#addToHistory(new EraserGroup(this.#eraseData));
      this.#eraseData = [];
    }
  }

  // ---- History handling ----
  /** Empty the whole history. */
  empty() {
    this.addGroup();
    this.#updateBrushLen();
    this.historyIndex = 0;
    this.history = [];
  }
  /**
   * Clears the history up until the current history index,
   * shaving off any redo data.
   */
  clear() {
    if (this.historyIndex < this.history.length) {
      for (const group of this.history.splice(this.historyIndex, Infinity)) {
        // TODO Common group interface
        group.cleanup?.();
      }
    }
  }

  #addToHistory(group) {
    this.clear();
    this.history.push(group);
    this.historyIndex++;
  }

  // ---- Helper functions ----
  #updateBrushLen() {
    this.#brushStartingLen = this.#brushBuffer.length;
  }
}
