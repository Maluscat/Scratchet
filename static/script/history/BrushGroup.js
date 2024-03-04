/**
 * @typedef { object } BrushHistoryData
 * @prop { number[][] } data The PosWrapper containing all points.
 * @prop { Array } target The target wrapper for the data.
 */

class BrushGroup {
  historyData;

  /**
   * @param { Array } buffer
   * @param { number } startIndex Inclusive.
   * @param { number } endIndex Exclusive.
   */
  constructor(buffer, startIndex, endIndex) {
    this.historyData = BrushGroup.#buildHistoryData(buffer, startIndex, endIndex);
  }

  undo() {
    for (const data of this.historyData) {
      data.target.length = 0;
    }
  }
  redo() {
    for (const data of this.historyData) {
      data.target.push(...data.data);
    }
  }

  /** @param { User } user */
  cleanup(user) {
    for (const data of this.historyData) {
      user.deleteFromBuffer(data.target);
    }
  }

  // ---- Static helpers ----
  static #buildHistoryData(buffer, startIndex, endIndex) {
    /** @type { BrushHistoryData[] } */
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
