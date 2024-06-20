import { BrushGroup } from '~/history/BrushGroup.js';
import { EraserGroup } from '~/history/EraserGroup.js';

/** @typedef { import('~/user/User.js').User } User */
/** @typedef { import('~/history/EraserGroup.js').EraserHistoryData } EraserHistoryData */

export class HistoryHandler {
  /** @type { Array<BrushGroup | EraserGroup> } */
  history = [];
  historyIndex = 0;

  #user;

  currentBrush;
  currentEraser;
  /**
   * Counts the amount of times a ping has been invoked
   * while the current group was being constructed.
   *
   * This can be interpreted as the connection having been safely
   * online for this many pings within this group
   * (which represents a time frame on a linear time scale).
   * @see {@link markIntact}
   */
  intactCounter = 0;

  /** @param { User } user Reference to the bound user. */
  constructor(user) {
    this.#user = user;
    this.currentBrush = new BrushGroup();
    this.currentEraser = new EraserGroup();
  }

  // ---- Undo/Redo ----
  undo(count) {
    for (let i = 0; i < count; i++) {
      if (this.historyIndex > 0) {
        const group = this.history[this.historyIndex - 1];
        group.undo();
        this.intactCounter += group.intactCount;
        this.historyIndex--;
      }
    }
  }
  redo(count) {
    for (let i = 0; i < count; i++) {
      if (this.historyIndex < this.history.length) {
        const group = this.history[this.historyIndex];
        group.redo();
        this.intactCounter -= group.intactCount;
        this.historyIndex++;
      }
    }
  }

  // ---- Group handling ----
  addGroup(intactCount) {
    this.#addGenericGroup(this.currentBrush, intactCount);
    this.#addGenericGroup(this.currentEraser, intactCount);
    this.currentBrush = new BrushGroup();
    this.currentEraser = new EraserGroup();
  }
  #addGenericGroup(group, intactCount = this.intactCounter) {
    if (group.historyData.length > 0) {
      group.close(intactCount);
      this.#addToHistory(group);
      return true;
    }
    return false;
  }

  // ---- History handling ----
  /** Empty the whole history. */
  empty() {
    this.addGroup();
    this.historyIndex = 0;
    this.history = [];
  }
  /**
   * Clears the history up until the current history index,
   * shaving off any redo data.
   *
   * @privateRemarks
   * The discarded groups need to be traversed in reverse
   * to transform any PosWrappers in the correct order.
   */
  clear() {
    if (this.historyIndex < this.history.length) {
      const discardedGroups = this.history.splice(this.historyIndex, Infinity);
      for (let i = discardedGroups.length - 1; i >= 0; i--) {
        const group = discardedGroups[i];
        group.cleanup(this.#user);
      }
    }
  }

  /**
   * Increment intact counter of the currently built group,
   * which the group will adopt once it is added to the history.
   * @see {@link #intactCounter}
   */
  markIntact() {
    this.intactCounter++;
  }

  /**
   * Get the last group's index which has at least the specified
   * total intact offset, starting at the most recent group.
   *
   * Returns 0 if the history is too small
   * as to reflect the specified intact offset.
   *
   * Returns false if the history is empty.
   *
   * @param { number } intactOffset How many intact counts need to be iterated.
   * @return { number | false } The relevant history group's index
   *                            or false if the history is empty.
   */
  getLastIntactGroupIndex(intactOffset) {
    let intactCount = this.intactCounter;
    for (let i = this.history.length - 1; i >= 0; i--) {
      const group = this.history[i];
      intactCount += group.intactCount;
      if (intactCount >= intactOffset || i === 0) {
        return this.history.indexOf(group);
      }
    }
    return false
  }

  #addToHistory(group) {
    this.clear();
    this.history.push(group);
    this.historyIndex++;
    this.intactCounter = 0;
  }
}
