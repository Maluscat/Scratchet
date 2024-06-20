import { PositionDataHandler } from '~/PositionDataHandler.js';

/** @typedef { import('~/user/User.js').User } User */

/**
 * Common baseline class for all groups.
 * @abstract
 */
export class HistoryGroup {
  /**
   * Specifies the amount of pings that have been dispatched
   * while this group was being constructed.
   */
  intactCount = null;

  undo() {
    throw new Error('You have to implement this method!');
  }
  redo() {
    throw new Error('You have to implement this method!');
  }
  /** @param {User} user */
  cleanup(user) {
    throw new Error('You have to implement this method!');
  }

  /** @param { number } intactCount */
  close(intactCount) {
    this.intactCount = intactCount;
  }

  /** @param { HistoryGroup } group */
  equal(group) {
    if (group.historyData.length !== this.historyData.length) return false;

    for (let i = 0; i < this.historyData.length; i++) {
      const data = this.historyData[i];
      const dataTarget = group.historyData[i];
      if (data.posWrapper.length !== dataTarget.posWrapper.length) return false;

      for (let j = 0; j < data.posWrapper.length; j++) {
        const posWrapper = data.posWrapper[j]
        const posWrapperTarget = dataTarget.posWrapper[j];
        if (!PositionDataHandler.posDataIsEqual(posWrapper, posWrapperTarget)) return false;
      }
    }

    return true;
  }
}
