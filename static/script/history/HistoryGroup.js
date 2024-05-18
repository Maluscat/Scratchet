/** @typedef { import('~/user/User.js').User } User */

/**
 * Common baseline class for all groups.
 * @abstract
 */
export class HistoryGroup {
  /**
   * Specifies the amount of pings that have been dispatched
   * while this group was being constructed.
   * @readonly
   */
  intactCount;

  /** @param { number } intactCount */
  constructor(intactCount) {
    this.intactCount = intactCount;
  }

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
}
