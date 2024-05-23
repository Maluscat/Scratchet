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

  addData(...posWrappers) {
    for (const posWrapper of posWrappers) {
      const info = /** @type BrushHistoryData */ ({
        posWrapper: Array.from(posWrapper),
        target: posWrapper
      });
      this.historyData.push(info);
    }
  }
}
