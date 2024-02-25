class EraserGroup {
  /** @type { UndoEraseInfo[] } */
  #undoData;

  constructor(data) {
    this.#undoData = data;
  }

  undo() {
    for (const info of this.#undoData) {
      info.target.push(info.wrapper);
    }
  }
  redo() {
    for (const info of this.#undoData) {
      info.target.splice(info.target.indexOf(info.wrapper), 1);
    }
  }

  cleanup() {
    for (let i = this.#undoData.length - 1; i >= 0; i--) {
      const info = this.#undoData[i];
      info.target.splice(0, Infinity, ...info.initialData);
    }
  }
}
