import { BrushGroup } from '~/history/BrushGroup.js';
import { EraserGroup } from '~/history/EraserGroup.js';

/** @typedef { import('~/user/User.js').User } User */
/** @typedef { import('~/history/EraserGroup.js').EraserHistoryData } EraserHistoryData */

export class HistoryHandler {
  /** @type { Array<BrushGroup | EraserGroup> } */
  history = [];
  historyIndex = 0;

  #user;
  #brushStartingLen;

  /** @type { EraserHistoryData[] } */
  #eraseHistoryStack = [];
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
    this.#updateBrushLen();
  }

  // ---- Undo/Redo ----
  undo(count) {
    this.addGroup();
    for (let i = 0; i < count; i++) {
      if (this.historyIndex > 0) {
        const group = this.history[this.historyIndex - 1];
        group.undo();
        this.historyIndex--;
      }
    }
    this.#updateBrushLen();
  }
  redo(count) {
    this.addGroup();
    for (let i = 0; i < count; i++) {
      if (this.historyIndex < this.history.length) {
        const group = this.history[this.historyIndex];
        group.redo();
        this.historyIndex++;
      }
    }
    this.#updateBrushLen();
  }

  // ---- Group handling ----
  addGroup() {
    this.#addBrushGroup();
    this.#addEraserGroup();
  }
  #addBrushGroup() {
    if (this.#brushStartingLen < this.#user.posCache.length) {
      const buffer = this.#user.posCache.slice(this.#brushStartingLen);
      const group = new BrushGroup(buffer, this.intactCounter);

      this.#addToHistory(group);
      this.#updateBrushLen();
    }
  }
  #addEraserGroup() {
    if (this.#eraseHistoryStack.length > 0) {
      this.#addToHistory(new EraserGroup(this.#eraseHistoryStack, this.intactCounter));
      this.#eraseHistoryStack = [];
    }
  }

  // ---- History handling ----
  /** Empty the whole history. */
  empty() {
    this.addGroup();
    this.#updateBrushLen();
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
        // TODO Common group interface
        group.cleanup(this.#user);
      }
    }
    this.#updateBrushLen();
  }

  /**
   * Increment intact counter of the currently built group,
   * which the group will adopt once it is added to the history.
   * @see {@link #intactCounter}
   */
  markIntact() {
    this.intactCounter++;
  }

  #addToHistory(group) {
    this.clear();
    this.history.push(group);
    this.historyIndex++;
    this.intactCounter = 0;
  }

  // ---- Helper functions ----
  #updateBrushLen() {
    this.#brushStartingLen = this.#user.posCache.length;
  }

  /**
   * Add an eraser undo entry to the eraser history stack
   * without checking whether a compatible entry already exists.
   * @param { Int16Array[][] } targetWrapper See {@link EraserHistoryData.target}
   * @param { Int16Array[][] } initialWrapper See {@link EraserHistoryData.initialWrapper}
   */
  addEraseDataUnchecked(targetWrapper, initialWrapper) {
    this.#eraseHistoryStack.push(/** @type EraserHistoryData */ ({
      initialWrapper,
      posWrapper: null,
      target: targetWrapper
    }));
  }
  /**
   * Add an eraser undo entry to the eraser history stack.
   * @param { Int16Array[][] } targetWrapper See {@link EraserHistoryData.target}
   * @param { Int16Array[][] } initialWrapper See {@link EraserHistoryData.initialWrapper}
   */
  addEraseData(targetWrapper, initialWrapper) {
    if (!this.#eraseHistoryStack.some(data => data.target === targetWrapper)) {
      this.addEraseDataUnchecked(targetWrapper, initialWrapper);
    }
  }
}
