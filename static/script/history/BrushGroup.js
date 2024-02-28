/**
 * @typedef { object } UndoBrushInfo
 * @prop { number[][] } data The PosWrapper containing all points.
 * @prop { Array } target The target wrapper for the data.
 */

class BrushGroup {
  redoData;

  /**
   * @param { Array } buffer
   * @param { number } startIndex Inclusive.
   * @param { number } endIndex Exclusive.
   */
  constructor(buffer, startIndex, endIndex) {
    this.redoData = BrushGroup.#buildRedoInfo(buffer, startIndex, endIndex);
  }

  undo() {
    for (const info of this.redoData) {
      info.target.length = 0;
    }
  }
  redo() {
    for (const info of this.redoData) {
      info.target.push(info.data);
    }
  }

  /** @param { User } user */
  cleanup(user) {
    for (const info of this.redoData) {
      user.deleteFromBuffer(info.target);
    }
  }

  // ---- Static helpers ----
  static #buildRedoInfo(buffer, startIndex, endIndex) {
    /** @type { UndoBrushInfo[] } */
    const redoData = [];
    for (let i = startIndex; i < endIndex; i++) {
      const posWrapper = buffer[i];
      const info = {
        data: Array.from(posWrapper),
        target: posWrapper
      };
      redoData.push(info);
    }
    return redoData;
  }
}
