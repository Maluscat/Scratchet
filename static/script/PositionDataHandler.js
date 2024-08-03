import * as Meta from '~/constants/meta.js';

export class PositionDataHandler {
  /**
   * Contains the posDataWrappers to draw in sequential order.
   * @type { Int16Array[][] }
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
  destIndexes = new Array();


  /** @param { Array } posWrapper */
  getPosIndex(posWrapper) {
    return this.buffer.indexOf(posWrapper);
  }

  /** @param { Array } posWrapper */
  deleteFromBuffer(posWrapper) {
    const index = this.buffer.indexOf(posWrapper);
    this.destIndexes.splice(index, 1);
    this.buffer.splice(index, 1);
  }

  /** @param { number } destIndex */
  getBufferFromInitIndex(destIndex) {
    if (destIndex < 0 || destIndex >= this.buffer.length) {
      throw new Error(`Given destIndex ${destIndex} out of bounds [0, ${this.buffer.length}]`);
    }
    return this.buffer[this.destIndexes.indexOf(destIndex)];
  }

  /**
   * Add a posDataWrapper to the {@link buffer} with an optional dest index.
   * @param { Int16Array[] } value The posDataWrapper to insert.
   * @param { number } destIndex The dest index of the posDataWrapper.
   */
  addToBuffer(value, destIndex = this.buffer.length) {
    const insertIndex = this.#getBufferInitInsertIndex(destIndex);
    this.destIndexes.splice(insertIndex, 0, destIndex);
    this.buffer.splice(insertIndex, 0, value);
  }


  // ---- Helper functions ----
  /**
   * Simple binary search. Returns the desired position of the input number.
   * (Inspired by https://stackoverflow.com/a/50612218).
   * @param { number } wrapperDestIndex The dest index to get the position of.
   * @return { number } An {@link destIndexes} index.
   */
  #getBufferInitInsertIndex(wrapperDestIndex) {
    let start = 0;
    let end = this.destIndexes.length - 1;
    while (start <= end) {
      const mid = Math.floor((start + end) / 2);

      if (this.destIndexes[mid] === wrapperDestIndex) {
        return mid;
      }

      if (wrapperDestIndex < this.destIndexes[mid]) {
        end = mid - 1;
      } else {
        start = mid + 1;
      }
    }
    return end + 1;
  }


  // ---- Static helper functions ----
  static posDataIsNotContinuous(posData0, posData1) {
    return posData0.at(-2) !== posData1[Meta.LEN.BRUSH]
        || posData0.at(-1) !== posData1[Meta.LEN.BRUSH + 1];
  }

  static posDataMetaHasChanged(posData0, posData1) {
    return Meta.getClientHue(posData0) !== Meta.getClientHue(posData1)
        || Meta.getClientWidth(posData0) !== Meta.getClientWidth(posData1)
  }

  /**
   * Slice a posData, creating a new Int16Array from the given
   * start and end indexes, preserving the metadata.
   *
   * *Attention*: It is possible for the return value to be a subarray
   * of the passed posData, sharing the same data.
   * @param { Int16Array } posData The original posData that will be sliced.
   * @param { number } startIndex The start index of the slice.
   * @param { number } endIndex The end index of the slice.
   *                            When omitted, it is set to the posData's length.
   */
  static slicePosData(posData, startIndex, endIndex = posData.length) {
    // The first sub array retains its original metadata, so we can just excerpt it
    if (startIndex <= Meta.LEN.BRUSH) {
      return posData.subarray(0, endIndex);
    } else {
      const newPosData = new Int16Array((endIndex - startIndex) + Meta.LEN.BRUSH);
      newPosData[0] = posData[0];
      newPosData[1] = posData[1];
      for (let i = 0; i < newPosData.length - Meta.LEN.BRUSH; i++) {
        newPosData[i + Meta.LEN.BRUSH] = posData[startIndex + i];
      }
      return newPosData;
    }
  }

  /**
   * Test whether one point of a centain size overlaps with another.
   * It doesn't matter which size belongs to which point.
   * @returns { boolean }
   */
  static positionsOverlap(pos0X, pos0Y, pos1X, pos1Y, width0, width1) {
    const distance = Math.sqrt(
          Math.pow(pos1X - pos0X, 2)
        + Math.pow(pos1Y - pos0Y, 2))
      - (width0 / 2)
      - (width1 / 2);
    return distance <= 0;
  }
  /**
   * Test whether the whole supplied PosData overlaps with the
   * supplied point with the specified radius.
   * @returns { boolean }
   */
  static posDataOverlaps(posData, posX, posY, width = 1) {
    for (let i = Meta.LEN.BRUSH; i < posData.length; i += 2) {
      if (PositionDataHandler.positionsOverlap(posData[i], posData[i + 1], posX, posY, width, posData[1])) {
        return true;
      }
    }
    return false;
  }

  /**
   * Test whether the two supplied PosDatas are exactly equal.
   *
   * Both PosDatas are compared from back to front to make
   * the process a tiny bit faster.
   * @param { Int16Array } posData0
   * @param { Int16Array } posData1
   * @returns { boolean }
   */
  static posDataIsEqual(posData0, posData1) {
    if (posData0.length !== posData1.length) return false;
    for (let i = posData0.length - 1; i >= 0; i--) {
      if (posData0[i] !== posData1[i]) return false;
    }
    return true;
  }

  // ---- Static iterator -----
  /**
   * @typedef { Object } recursePosWrapperYield
   * @prop { Int16Array } posData
   * @prop { Array } wrapperStack
   * @prop { number } index
   */

  /**
   * Recursively iterate over multiple PosWrappers, yielding only their PosData.
   * @param { number[][] } posWrappers
   * @param { (yield: recursePosWrapperYield) => void } callback
   */
  static iteratePosWrappers(posWrappers, callback) {
    for (const posWrapper of posWrappers) {
      this.#iteratePosWrapperHelper([ posWrapper ], callback);
    }
  }
  /**
   * Recursively iterate over one PosWrapper, yielding only its PosData.
   * Return `true` within the callback to break the loop.
   * @param { number[] } posWrapper
   * @param { (yield: recursePosWrapperYield) => void } callback
   */
  static iteratePosWrapper(posWrapper, callback) {
    this.#iteratePosWrapperHelper([ posWrapper ], callback);
  }

  static #iteratePosWrapperHelper(wrapperStack, callback, index = 0) {
    const posData = wrapperStack.at(-1);
    if (posData.length === 0) return;

    if (Array.isArray(posData) && typeof posData[0] !== 'number') {
      // Pinning and continuously checking the length to allow
      // for in-place modification of the array while looping.
      const length = posData.length;
      for (let i = 0; i < length; i++) {
        if (i >= posData.length) break;

        wrapperStack.push(posData[i]);

        if (this.#iteratePosWrapperHelper(wrapperStack, callback, i) === true) {
          return true;
        }

        wrapperStack.pop();
      }
    } else {
      return callback({ posData, wrapperStack, index });
    }
  }
}
