'use strict';
class PositionDataHandler {
  /**
   * Contains the posDataWrappers to draw in sequential order.
   */
  posBuffer = new Array();
  /**
   * - Contains the "bulk init indexes" / "wrapper destination indexes"
   * for the corresponding entries in {@link posBuffer},
   * so that potentially incoming bulk init user data can be sequenced
   * into the {@link posBuffer} by its indexes, retaining draw order.
   * - Is deleted in the constructor after an approximated timespan
   * when all peer data should have arrived
   */
  initPosIndexes = new Array();

  constructor() {
    setTimeout(() => {
      delete this.initPosIndexes;
    }, Global.MAX_INIT_TRANSMISSION_TIME);
  }


  /**
   * Simple binary search. Returns the desired position of the input number.
   * (Inspired by https://stackoverflow.com/a/50612218).
   * @param {number} wrapperDestIndex The bulk init index to get the position of.
   * @return {number} An {@link initPosIndexes} index.
   */
  getPosDataIndex(wrapperDestIndex) {
    let start = 0;
    let end = this.initPosIndexes.length - 1;
    while (start <= end) {
      const mid = Math.floor((start + end) / 2);

      if (this.initPosIndexes[mid] === wrapperDestIndex) {
        return mid;
      }

      if (wrapperDestIndex < this.initPosIndexes[mid]) {
        end = mid - 1;
      } else {
        start = mid + 1;
      }
    }
    return end + 1;
  }

  deleteFromPosBuffer(item) {
    this.posBuffer.splice(this.posBuffer.indexOf(item), 1);
  }

  /**
   * Add a posDataWrapper to the {@link posBuffer} with an optional init index,
   * at an optional array position.
   * @param {Array<Array<number>>} value The posDataWrapper to insert.
   * @param {number} [initIndex = Infinity] The init index of the posDataWrapper.
   * @param {number} [insertIndex = Infinity] The array index to insert value at.
   */
  addToPosBuffer(value, initIndex = Infinity, insertIndex = Infinity) {
    // insertIndex === Infinity is equivalent to `Array.push`
    if (this.initPosIndexes) {
      this.initPosIndexes.splice(insertIndex, 0, initIndex);
    }
    this.posBuffer.splice(insertIndex, 0, value);
  }
}
