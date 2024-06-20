import { HistoryGroup } from './HistoryGroup.js';

/** @typedef { import('~/user/User.js').User } User */

/**
 * NOTE: This extends an imaginary interface that ensures that the properties
 * `posWrapper` and `target` stay the same over all group history data interfaces.
 * @typedef { object } BrushHistoryData
 * @prop { Int16Array[] } posWrapper The PosWrapper containing all points.
 * @prop { Array } target The target wrapper for the data.
 */

export class BrushGroup extends HistoryGroup {
  /** @type { BrushHistoryData[] } */
  historyData = [];

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

  addData(...posDataWrappers) {
    for (const posDataWrapper of posDataWrappers) {
      const info = /** @type BrushHistoryData */ ({
        posWrapper: Array.from(posDataWrapper),
        target: posDataWrapper
      });
      this.historyData.push(info);
    }
  }
}
