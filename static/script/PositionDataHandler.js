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
    return posData0.at(-2) !== posData1[Meta.LEN.BRUSH]
        || posData0.at(-1) !== posData1[Meta.LEN.BRUSH + 1];
  }

  static posDataMetaHasChanged(posData0, posData1) {
    return Meta.getClientHue(posData0) !== Meta.getClientHue(posData1)
        || Meta.getClientWidth(posData0) !== Meta.getClientWidth(posData1)
  }


  // ---- Static protocol converter ----
  static convertServerDataToClientData(posData, user) {
    const flag = posData[0];
    const extraLen = Meta.getExtraLengthFromFlag(flag);

    const clientPosData = new Int16Array(posData.length + extraLen);
    clientPosData.set(posData, extraLen);
    // Shift items to the left
    for (let i = extraLen; i < Meta.LEN.BRUSH - 1; i++) {
      clientPosData[i] = clientPosData[i + 1];
    }

    if (extraLen > 0) {
      if (user.posCache.length === 0) {
        return false;
      }

      const lastPosData = user.posCache[user.posCache.length - 1][0];

      // Get width/hue of the last package
      if (flag & Meta.FLAGS.LAST_WIDTH) {
        clientPosData[0] = clientPosData[1];
        clientPosData[1] = Meta.getClientWidth(lastPosData);
      }
      if (flag & Meta.FLAGS.LAST_HUE) {
        clientPosData[0] = Meta.getClientHue(lastPosData);
      }
    }

    clientPosData[2] = flag;

    return clientPosData;
  }
  static convertClientDataToServerData(posData) {
    const flag = posData[2];
    let extraLen = Meta.getExtraLengthFromFlag(flag);

    const serverPosData = new Int16Array(posData.length - extraLen);
    serverPosData.set(posData.subarray(extraLen));
    // Shift items to the right
    for (let i = Meta.LEN.BRUSH - extraLen - 1 - 1; i >= 0; i--) {
      serverPosData[i + 1] = serverPosData[i];
    }

    if ((flag & Meta.FLAGS.LAST_WIDTH) === 0) {
      serverPosData[extraLen--] = Meta.getClientWidth(posData);
    }
    if ((flag & Meta.FLAGS.LAST_HUE) === 0) {
      serverPosData[extraLen--] = Meta.getClientHue(posData);
    }

    serverPosData[0] = flag;

    return serverPosData;
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
   * @param { number[] } posWrapper
   * @param { (yield: recursePosWrapperYield) => void } callback
   */
  static iteratePosWrapper(posWrapper, callback) {
    this.#iteratePosWrapperHelper([ posWrapper ], callback);
  }

  static #iteratePosWrapperHelper(wrapperStack, callback, index = 0) {
    const posData = wrapperStack.at(-1);
    if (posData.length === 0) return;

    if (Array.isArray(posData) && typeof posData[0] !== 'number' || posData instanceof Set) {
      let i = 0;
      for (const childWrapper of posData) {
        wrapperStack.push(childWrapper);

        this.#iteratePosWrapperHelper(wrapperStack, callback, i);

        wrapperStack.pop();
        i++;
      }
    } else {
      callback({ posData, wrapperStack, index });
    }
  }
}
