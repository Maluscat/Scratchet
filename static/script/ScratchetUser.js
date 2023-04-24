'use strict';
/**
 * @typedef { Object } UndoEraseInfo
 * @prop { number } bufferIndex At which buffer length the info object is applied to.
 * @prop { Array<Array> } wrapper The posData points.
 * @prop { Array<Array> } target The target posWrapper for {@link UndoEraseInfo.wrapper}.
 * @prop { Array<Int16Array> } initialData All posData of {@link UndoEraseInfo.target} before the erase.
 */

class ScratchetUser {
  userID;
  name;
  posCache = new Array();

  listNode;
  activeTimeout;

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

  /**
   * Contains points which were undone so that they can be redone.
   */
  redoBuffer = new Array();

  constructor(userID, username) {
    this.userID = userID;
    this.name = username;
    this.listNode = this.createUserListNode(username, userID === CURRENT_USER_ID);
  }

  setName(newUsername) {
    this.name = newUsername;
    this.listNode.textContent = newUsername;
  }

  setColorIndicator(hue) {
    this.listNode.style.color = makeHSLString(hue);

    if (this.activeTimeout != null) {
      clearTimeout(this.activeTimeout);
    }
    this.activeTimeout = setTimeout(() => {
      this.listNode.style.removeProperty('color');
      this.activeTimeout = null;
    }, Global.SEND_INTERVAL * 1.5);
  }

  // ---- Undo/Redo ----
  /** @param {ScratchetCanvas} room */
  undo(room) {
    if (this.undoEraseIndex > 0
        && this.posCache.length - 1 === this.undoEraseQueue[this.undoEraseIndex - 1].at(-1).bufferIndex) {

      for (const info of this.undoEraseQueue[this.undoEraseIndex - 1]) {
        info.target.push(info.wrapper);
      }

      this.undoEraseIndex--;
      room.redrawCanvas();
    } else if (room.posBuffer.length > 0) {
      const posDataWrapper = this.posCache.pop();
      this.redoBuffer.push(posDataWrapper);
      room.deleteFromPosBuffer(posDataWrapper);
      room.redrawCanvas();
    }
  }
  /** @param {ScratchetCanvas} room */
  redo(room) {
    if (this.undoEraseIndex < this.undoEraseQueue.length
        && this.posCache.length - 1 === this.undoEraseQueue[this.undoEraseIndex].at(-1).bufferIndex) {

      for (const info of this.undoEraseQueue[this.undoEraseIndex]) {
        info.target.splice(info.target.indexOf(info.wrapper), 1);
      }

      this.undoEraseIndex++;
      room.redrawCanvas();
    } else if (this.redoBuffer.length > 0) {
      const posDataWrapper = this.redoBuffer.pop();
      this.posCache.push(posDataWrapper);
      room.addToPosBuffer(posDataWrapper);
      room.redrawCanvas();
    }
  }

  clearRedoBuffer(undoEraseOffsetEnd = 0) {
    if (this.redoBuffer.length > 0) {
      this.redoBuffer = new Array();
    }
    if (this.undoEraseIndex < this.undoEraseQueue.length) {
      const removedPosData = this.undoEraseQueue.splice(
        this.undoEraseIndex,
        this.undoEraseQueue.length - 1 - undoEraseOffsetEnd);

      for (let i = removedPosData.length - 1; i >= 0; i--) {
        const infoWrapper = removedPosData[i];

        for (let j = infoWrapper.length - 1; j >= 0; j--) {
          const info = infoWrapper[j];

          info.target.splice(0, Infinity, ...info.initialData);
        }
      }
    }
  }

  addToUndoEraseQueue(eraseWrapper, targetWrapper, initialPosData) {
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

  // ---- Events ----
  listNodeMouseEnter() {
    controller.highlightUser(this);
  }
  listNodeMouseLeave() {
    controller.activeRoom.redrawCanvas();
  }

  // ---- Helper functions ----
  createUserListNode(username, isOwnUser) {
    const listNode = document.createElement('span');
    listNode.classList.add('item');
    if (isOwnUser) {
      listNode.classList.add('current');
    }
    listNode.textContent = username;

    listNode.addEventListener('mouseenter', this.listNodeMouseEnter.bind(this));
    listNode.addEventListener('mouseleave', this.listNodeMouseLeave.bind(this));

    return listNode;
  }
}
