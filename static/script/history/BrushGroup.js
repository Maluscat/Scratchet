import { HistoryGroup } from './HistoryGroup.js';

/** @typedef { import('~/user/User.js').User } User */

/**
 * NOTE: This extends an imaginary interface that ensures that the properties
 * `posWrapper` and `target` stay the same over all group history data interfaces.
 * @typedef { object } BrushHistoryData
 * @prop { number[][] } posWrapper The PosWrapper containing all points.
 * @prop { Array } target The target wrapper for the data.
 */

export class BrushGroup extends HistoryGroup {
  historyData;

  /**
   * @param { Array } buffer
   * @param { number } startIndex Inclusive.
   * @param { number } endIndex Exclusive.
   */
  constructor(buffer, startIndex, endIndex, intactCount) {
    super(intactCount);
    this.historyData = BrushGroup.#buildHistoryData(buffer, startIndex, endIndex);
  }

  undo() {
    for (const data of this.historyData) {
      data.target.length = 0;
    }
  }
  redo() {
    for (const data of this.historyData) {
      data.target.push(...data.posWrapper);
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
      const info = /** @type BrushHistoryData */ ({
        posWrapper: Array.from(posWrapper),
        target: posWrapper
      });
      redoData.push(info);
    }
    return redoData;
  }
}
