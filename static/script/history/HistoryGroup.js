/** @typedef { import('~/user/User.js').User } User */

/**
 * Common baseline class for all groups.
 * @abstract
 */
export class HistoryGroup {
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
