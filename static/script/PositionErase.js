'use strict';
class PositionErase {
  /**
   * Erase all points in the given buffer that are in range of the eraser
   * at the given coordinates and size.
   * @param { number[] } buffer The buffer (posWrapper) to operate on.
   * @param { UndoEraseInfo[] } undoStack The undo info target array.
   * @param { number } posX The eraser position.x to check against.
   * @param { number } posY The eraser position.y to check against.
   * @param { number } eraserWidth The eraser diameter.
   */
  static eraseAtPos(buffer, undoStack, posX, posY, eraserWidth) {
    let hasErased = false;
    let lastWrapper;

    PositionDataHandler.iteratePosWrapper(buffer, ({ posData, wrapperStack, index }) => {
      const posDataWrapper = wrapperStack.at(-2);
      const initialWrapper = [ ...posDataWrapper ];

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
          hasErased = true;
        } else if (isErasing) {
          isErasing = false;
          startIdx = j;
        }
      }

      // The last section needs to be handled manually.
      // This is the same procedure as in the loop above.
      if (!isErasing) {
        if (startIdx > Meta.LEN.BRUSH) {
          const newPosData = PositionDataHandler.slicePosData(posData, startIdx);
          posDataWrapper[index] = newPosData;
        }
      } else {
        // Remove the initial posData if the last vector in it has been erased
        posDataWrapper.splice(index, 1);
      }

      if (hasErased) {
        this.#addToUndoStack(undoStack, posDataWrapper, initialWrapper);
      }

      lastWrapper = posDataWrapper;
    });

    return hasErased;
  }


  /**
   * Add an eraser undo entry to a given array which
   * can be used to undo the erase step.
   * @param { UndoEraseInfo[] } stack The stack that the data is pushed into.
   * @param { Int16Array[][] } targetWrapper A PosDataWrapper that contained the points.
   */
  static #addToUndoStack(stack, targetWrapper, initialWrapper) {
    const hasInfo = stack.some(info => info.target === targetWrapper);
    if (!hasInfo) {
      stack.push(/** @type UndoEraseInfo */ ({
        initialWrapper,
        newWrapper: null,
        target: targetWrapper
      }));
    }
  }
}
