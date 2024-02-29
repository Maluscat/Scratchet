'use strict';
/**
 * @typedef { Object } UndoEraseInfo
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
   */
  static eraseAtPos(buffer, posX, posY, eraserWidth) {
    const undoStack = [];
    let redoWrapper;
    let lastWrapper;

    PositionDataHandler.iteratePosWrapper(buffer, ({ posData, wrapperStack, index }) => {
      const posDataWrapper = wrapperStack.at(-2);
      const initialPosData = [ ...posDataWrapper ];

      if (posDataWrapper !== lastWrapper) {
        redoWrapper = [];
      }

      let startIdx = Meta.LEN.BRUSH;
      let isErasing = false;

      // j is used as the endIndex
      for (let j = Meta.LEN.BRUSH; j < posData.length; j += 2) {
        if (PositionDataHandler.positionsOverlap(posData[j], posData[j + 1], posX, posY, eraserWidth, posData[1])) {
          if (!isErasing) {
            if (startIdx !== j) {
              const newPosData = PositionDataHandler.slicePosData(posData, startIdx, j);
              posDataWrapper.push(newPosData);
            }
            // This needs to be at this level to accomodate for the cleanup
            isErasing = true;
            startIdx = j;
          }
        } else if (isErasing) {
          if (startIdx !== j) {
            // REMINDER: j is never posData.length
            const eraseData = PositionDataHandler.slicePosData(
              posData, Math.max(Meta.LEN.BRUSH, startIdx - 2), j + 2);
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
          : PositionDataHandler.slicePosData(posData, startIdx - 2);
        redoWrapper.push(eraseData);
      } else if (startIdx > Meta.LEN.BRUSH) {
        const newPosData = PositionDataHandler.slicePosData(posData, startIdx);
        posDataWrapper[index] = newPosData;
      }

      // Remove the initial posData if the last vector in it has been erased
      if (isErasing) {
        posDataWrapper.splice(index, 1);
      }

      if (redoWrapper.length > 0) {
        this.#addToUndoStack(undoStack, redoWrapper, posDataWrapper, initialPosData);
      }

      lastWrapper = posDataWrapper;
    });

    return undoStack;
  }

  /**
   * Add an eraser undo entry to a given array which
   * can be used to undo the erase step.
   * @param { UndoEraseInfo[] } stack The stack that the data is pushed into.
   * @param { Int16Array[] } eraseWrapper A PosData containing the erased points.
   * @param { Int16Array[][] } targetWrapper A PosDataWrapper that contained the points.
   * @param { Int16Array[][] } initialPosData A PosDataWrapper containing the intact
   *                                          points before the erase.
   */
  static #addToUndoStack(stack, eraseWrapper, targetWrapper, initialPosData) {
    const lastInfo = stack.at(-1);
    if (lastInfo?.target === targetWrapper) {
      lastInfo.wrapper.push(...eraseWrapper);
    } else {
      stack.push(/** @type {UndoEraseInfo} */ ({
        initialData: initialPosData,
        wrapper: eraseWrapper,
        target: targetWrapper
      }));
    }
  }
}
