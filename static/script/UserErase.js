'use strict';
/**
 * @typedef { Object } UndoEraseInfo
 * @prop { number } bufferIndex At which buffer length the info object is applied to.
 * @prop { Array<Array> } wrapper The posData points.
 * @prop { Array<Array> } target The target posWrapper for {@link UndoEraseInfo.wrapper}.
 * @prop { Array<Int16Array> } initialData All posData of {@link UndoEraseInfo.target} before the erase.
 */

class UserErase {
  posCache = new Array();

  /**
   * Contains information of erased points so that they can be redone.
   * - One info wrapper is exactly one undo/redo step.
   * - Every info wrapper contains multiple {@link UndoEraseInfo} objects.
   * - Is used in conjunction with {@link undoEraseIndex}.
   * @type { Array<Array<UndoEraseInfo>> }
   */
  undoEraseQueue = new Array();
  /**
   * {@link undoEraseQueue} at this index is the current valid eraser undo/redo step.
   */
  undoEraseIndex = 0;

  eraseAtPos(posX, posY, eraserWidth) {
    let hasChanged = false;
    let redoWrapper;
    let lastWrapper;

    for (const { posData, wrapperStack, index } of ScratchetCanvas.iteratePosWrapper(this.posCache)) {
      const posWrapper = wrapperStack.at(-2);
      const initialPosData = [ ...posWrapper ];

      if (posWrapper !== lastWrapper) {
        redoWrapper = [];
      }

      let startIdx = META_LEN.NORMAL;
      let isErasing = false;

      // j is used as the endIndex
      for (let j = META_LEN.NORMAL; j < posData.length; j += 2) {
        if (this.#posIsInEraseRange(posData[j], posData[j + 1], posX, posY, eraserWidth, posData[1])) {
          if (!isErasing) {
            if (startIdx !== j) {
              const newPosData = this.#createNewPosData(posData, startIdx, j);
              posWrapper.push(newPosData);
            }
            // This needs to be at this level to accomodate for the cleanup
            hasChanged = true;
            isErasing = true;
            startIdx = j;
          }
        } else if (isErasing) {
          if (startIdx !== j) {
            // REMINDER: j is never posData.length
            const eraseData =
              this.#createNewPosData(posData, Math.max(META_LEN.NORMAL, startIdx - 2), j + 2);
            redoWrapper.push(eraseData);
          }
          isErasing = false;
          startIdx = j;
        }
      }

      // The last section needs to be handled manually.
      // This is the same procedure as in the loop above.
      if (isErasing) {
        const eraseData = (startIdx === META_LEN.NORMAL)
          ? posData
          : this.#createNewPosData(posData, startIdx - 2);
        redoWrapper.push(eraseData);
      } else if (startIdx > META_LEN.NORMAL) {
        const newPosData = this.#createNewPosData(posData, startIdx);
        posWrapper[index] = newPosData;
      }

      // Remove the initial posData if the last vector in it has been erased
      if (isErasing) {
        posWrapper.splice(index, 1);
        hasChanged = true;
      }

      if (hasChanged && redoWrapper.length > 0) {
        this.#addToUndoEraseQueue(redoWrapper, posWrapper, initialPosData);
      }

      lastWrapper = posWrapper;
    }

    return hasChanged;
  }

  #posIsInEraseRange(testPosX, testPosY, erasePosX, erasePosY, eraserWidth, strokeWidth) {
    const distance = Math.sqrt(
          Math.pow(erasePosX - testPosX, 2)
        + Math.pow(erasePosY - testPosY, 2))
      - (eraserWidth / 2)
      - (strokeWidth / 2);
    return distance <= 0;
  }

  // Create new Int16Array from a start index to end index of posData
  #createNewPosData(originalPosData, startIdx, endIdx = originalPosData.length) {
    // The first sub array retains its original metadata, so we can just excerpt it
    if (startIdx === META_LEN.NORMAL) {
      return originalPosData.subarray(0, endIdx);
    } else {
      const newPosData = new Int16Array((endIdx - startIdx) + META_LEN.NORMAL);
      newPosData[0] = originalPosData[0];
      newPosData[1] = originalPosData[1];
      for (let i = 0; i < newPosData.length - META_LEN.NORMAL; i++) {
        newPosData[i + META_LEN.NORMAL] = originalPosData[startIdx + i];
      }
      return newPosData;
    }
  }

  #addToUndoEraseQueue(eraseWrapper, targetWrapper, initialPosData) {
    let infoWrapper;
    if (this.undoEraseQueue.length === this.undoEraseIndex + 1) {
      infoWrapper = this.undoEraseQueue.at(-1);
    } else {
      infoWrapper = [];
      this.undoEraseQueue.push(infoWrapper);
    }

    const lastInfo = infoWrapper.at(-1);
    if (lastInfo?.target === targetWrapper) {
      lastInfo.wrapper.push(...eraseWrapper);
    } else {
      infoWrapper.push(/** @type {UndoEraseInfo} */ ({
        bufferIndex: this.posCache.length - 1,
        initialData: initialPosData,
        wrapper: eraseWrapper,
        target: targetWrapper
      }));
    }
  }
}
