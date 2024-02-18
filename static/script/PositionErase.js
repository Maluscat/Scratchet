'use strict';
/**
 * @typedef { Object } UndoEraseInfo
 * @prop { number } bufferIndex At which buffer length the info object is applied to.
 * @prop { Array<Array> } wrapper The posData points.
 * @prop { Array<Array> } target The target posWrapper for {@link UndoEraseInfo.wrapper}.
 * @prop { Array<Int16Array> } initialData All posData of {@link UndoEraseInfo.target} before the erase.
 */

class PositionErase {
  /**
   * Erase all points in the given buffer that are in range of the eraser
   * at the given coordinates and size.
   * @param { number[] } buffer The buffer (posWrapper) to operate on.
   * @param { number } posX The eraser position.x to check against.
   * @param { number } posY The eraser position.y to check against.
   * @param { number } eraserWidth The eraser diameter.
   * @param { () => void } [beforeChangeCallback] A callback that is called before a new posData can be created.
   */
  static eraseAtPos(buffer, posX, posY, eraserWidth, beforeChangeCallback) {
    const undoStack = [];
    let redoWrapper;
    let lastWrapper;

    for (const { posData, wrapperStack, index } of PositionDataHandler.iteratePosWrapper(buffer)) {
      const posDataWrapper = wrapperStack.at(-2);
      const initialPosData = [ ...posDataWrapper ];

      if (posDataWrapper !== lastWrapper) {
        redoWrapper = [];
      }

      let startIdx = Meta.LEN.BRUSH;
      let isErasing = false;

      // j is used as the endIndex
      for (let j = Meta.LEN.BRUSH; j < posData.length; j += 2) {
        if (this.#posIsInEraseRange(posData[j], posData[j + 1], posX, posY, eraserWidth, posData[1])) {
          if (!isErasing) {
            // NOTE: This isn't exactly "before erase" but it is sufficient for the given purposes.
            beforeChangeCallback?.();
            if (startIdx !== j) {
              const newPosData = this.#createNewPosData(posData, startIdx, j);
              posDataWrapper.push(newPosData);
            }
            // This needs to be at this level to accomodate for the cleanup
            isErasing = true;
            startIdx = j;
          }
        } else if (isErasing) {
          if (startIdx !== j) {
            // REMINDER: j is never posData.length
            const eraseData =
              this.#createNewPosData(posData, Math.max(Meta.LEN.BRUSH, startIdx - 2), j + 2);
            redoWrapper.push(eraseData);
          }
          isErasing = false;
          startIdx = j;
        }
      }

      // The last section needs to be handled manually.
      // This is the same procedure as in the loop above.
      if (isErasing) {
        const eraseData = (startIdx === Meta.LEN.BRUSH)
          ? posData
          : this.#createNewPosData(posData, startIdx - 2);
        redoWrapper.push(eraseData);
      } else if (startIdx > Meta.LEN.BRUSH) {
        const newPosData = this.#createNewPosData(posData, startIdx);
        posDataWrapper[index] = newPosData;
      }

      // Remove the initial posData if the last vector in it has been erased
      if (isErasing) {
        posDataWrapper.splice(index, 1);
      }

      if (redoWrapper.length > 0) {
        this.#addToUndoStack(undoStack, buffer.length, redoWrapper, posDataWrapper, initialPosData);
      }

      lastWrapper = posDataWrapper;
    }

    return undoStack;
  }

  /**
   * Add an eraser undo entry to a given array which
   * can be used to undo the erase step.
   * @param { UndoEraseInfo[] } stack The stack that the data is pushed into.
   * @param { number } bufferLen The current length of the user's relevant pos buffer.
   * @param { Int16Array[] } eraseWrapper A PosData containing the erased points.
   * @param { Int16Array[][] } targetWrapper A PosDataWrapper that contained the points.
   * @param { Int16Array[][] } initialPosData A PosDataWrapper containing the intact
   *                                          points before the erase.
   */
  static #addToUndoStack(stack, bufferLen, eraseWrapper, targetWrapper, initialPosData) {
    const lastInfo = stack.at(-1);
    if (lastInfo?.target === targetWrapper) {
      lastInfo.wrapper.push(...eraseWrapper);
    } else {
      stack.push(/** @type {UndoEraseInfo} */ ({
        bufferIndex: bufferLen - 1,
        initialData: initialPosData,
        wrapper: eraseWrapper,
        target: targetWrapper
      }));
    }
  }

  // ---- Helper functions ----
  /**
   * Slice a posData, creating a new Int16Array from the given start and end indexes.
   * @param { Int16Array } originalPosData The original posData that will be sliced.
   * @param { number } startIdx The start index of the slice.
   * @param { number } endIdx The end index of the slice.
   *                          When omitted, it is set to the posData's length.
   */
  static #createNewPosData(originalPosData, startIdx, endIdx = originalPosData.length) {
    // The first sub array retains its original metadata, so we can just excerpt it
    if (startIdx === Meta.LEN.BRUSH) {
      return originalPosData.subarray(0, endIdx);
    } else {
      const newPosData = new Int16Array((endIdx - startIdx) + Meta.LEN.BRUSH);
      newPosData[0] = originalPosData[0];
      newPosData[1] = originalPosData[1];
      for (let i = 0; i < newPosData.length - Meta.LEN.BRUSH; i++) {
        newPosData[i + Meta.LEN.BRUSH] = originalPosData[startIdx + i];
      }
      return newPosData;
    }
  }

  /**
   * Test whether the eraser of some size at some point
   * is in range of a stroke point of some size at some point.
   * @returns { boolean }
   */
  static #posIsInEraseRange(testPosX, testPosY, erasePosX, erasePosY, eraserWidth, strokeWidth) {
    const distance = Math.sqrt(
          Math.pow(erasePosX - testPosX, 2)
        + Math.pow(erasePosY - testPosY, 2))
      - (eraserWidth / 2)
      - (strokeWidth / 2);
    return distance <= 0;
  }
}
