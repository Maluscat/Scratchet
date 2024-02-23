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
    this.#brushStartingLen = brushBuffer.length;
  }


  undo(count, posHandler) {
    for (let i = 0; i < count; i++) {
      if (this.historyIndex > 0) {
        const group = this.history[this.historyIndex - 1];
        group.undo(posHandler);
        this.historyIndex--;
      }
    }
  }
  redo(count, posHandler) {
    for (let i = 0; i < count; i++) {
      if (this.historyIndex < this.history.length) {
        const group = this.history[this.historyIndex];
        group.redo(posHandler);
        this.historyIndex++;
      }
    }
  }


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
      this.#brushStartingLen = this.#brushBuffer.length;
    }
  }
  #addEraserGroup() {
    if (this.#eraseData.length > 0) {
      this.#addToHistory(new EraserGroup(this.#eraseData));
      this.#eraseData = [];
    }
  }

  #addToHistory(group) {
    this.clear();
    this.history.push(group);
    this.historyIndex++;
  }

  clear() {
    if (this.historyIndex < this.history.length) {
      for (const group of this.history.splice(this.historyIndex, Infinity)) {
        // TODO Common group interface
        group.cleanup?.();
      }
    }
  }
}
