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


  /** @param { Array } posWrapper */
  getPosIndex(posWrapper) {
    return this.buffer.indexOf(posWrapper);
  }

  /** @param { Array } posWrapper */
  deleteFromBuffer(posWrapper) {
    const index = this.buffer.indexOf(posWrapper);
    if (this.initIndexes) {
      this.initIndexes.splice(index, 1);
    }
    this.buffer.splice(index, 1);
  }

  /**
   * Add a posDataWrapper to the {@link buffer} with an optional init index.
   * @param { Array<Array<number>> } value The posDataWrapper to insert.
   * @param { number } [initIndex = Infinity] The init index of the posDataWrapper.
   */
  addToBuffer(value, initIndex = Infinity) {
    const insertIndex = this.#getBufferInitInsertIndex(initIndex);
    if (this.initIndexes) {
      this.initIndexes.splice(insertIndex, 0, initIndex);
    }
    this.buffer.splice(insertIndex, 0, value);
  }


  // ---- Helper functions ----
  /**
   * Simple binary search. Returns the desired position of the input number.
   * This includes Infinity if the position is always at the end.
   * (Inspired by https://stackoverflow.com/a/50612218).
   * @param { number } wrapperDestIndex The bulk init index to get the position of.
   * @return { number } An {@link initIndexes} index or Infinity.
   */
  #getBufferInitInsertIndex(wrapperDestIndex) {
    if (!this.initIndexes || wrapperDestIndex === Infinity) return Infinity;

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


  // ---- Static helper functions ----
  static posDataIsNotContinuous(posData0, posData1) {
    return posData0.at(-2) !== posData1[META_LEN.BRUSH]
        || posData0.at(-1) !== posData1[META_LEN.BRUSH + 1];
  }

  static posDataMetaHasChanged(posData0, posData1) {
    return getClientMetaHue(posData0) !== getClientMetaHue(posData1)
        || getClientMetaWidth(posData0) !== getClientMetaWidth(posData1)
  }
}
