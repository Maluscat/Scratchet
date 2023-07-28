'use strict';
class PositionDataHandler {
  /**
   * Contains the posDataWrappers to draw in sequential order.
   */
  buffer = new Array();
  /**
   * - Contains the "bulk init indexes" / "wrapper destination indexes"
   * for the corresponding entries in {@link buffer},
   * so that potentially incoming bulk init user data can be sequenced
   * into the {@link buffer} by its indexes, retaining draw order.
   * - Is deleted in the constructor after an approximated timespan
   * when all peer data should have arrived
   */
  initIndexes = new Array();

  constructor() {
    setTimeout(() => {
      delete this.initIndexes;
    }, Global.MAX_INIT_TRANSMISSION_TIME);
  }


  deleteFromBuffer(item) {
    this.buffer.splice(this.buffer.indexOf(item), 1);
  }

  /**
   * Add a posDataWrapper to the {@link buffer} with an optional init index.
   * @param { Array<Array<number>> } value The posDataWrapper to insert.
   * @param { number } [initIndex = Infinity] The init index of the posDataWrapper.
   */
  addToBuffer(value, initIndex = Infinity) {
    const insertIndex = this.#getPosDataIndex(initIndex);
    if (this.initIndexes) {
      this.initIndexes.splice(insertIndex, 0, initIndex);
    }
    this.buffer.splice(insertIndex, 0, value);
  }


  // ---- Helper functions ----
  /**
   * Simple binary search. Returns the desired position of the input number
   * or Infinity when {@link initIndexes} is empty.
   * (Inspired by https://stackoverflow.com/a/50612218).
   * @param { number } wrapperDestIndex The bulk init index to get the position of.
   * @return { number } An {@link initIndexes} index or Infinity.
   */
  #getPosDataIndex(wrapperDestIndex) {
    if (!this.initIndexes) return Infinity;

    let start = 0;
    let end = this.initIndexes.length - 1;
    while (start <= end) {
      const mid = Math.floor((start + end) / 2);

      if (this.initIndexes[mid] === wrapperDestIndex) {
        return mid;
      }

      if (wrapperDestIndex < this.initIndexes[mid]) {
        end = mid - 1;
      } else {
        start = mid + 1;
      }
    }
    return end + 1;
  }
}
