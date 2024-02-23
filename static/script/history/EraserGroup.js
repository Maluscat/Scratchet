class EraserGroup {
  /** @type { UndoEraseInfo[] } */
  #data;

  constructor(data) {
    this.#data = data;
  }

  undo() {
    for (const info of this.#data) {
      info.target.push(info.wrapper);
    }
  }
  redo() {
    for (const info of this.#data) {
      info.target.splice(info.target.indexOf(info.wrapper), 1);
    }
  }

  cleanup() {
    for (let i = this.#data.length - 1; i >= 0; i--) {
      const info = this.#data[i];
      info.target.splice(0, Infinity, ...info.initialData);
    }
  }
}
