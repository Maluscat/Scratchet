'use strict';
class ScratchetUser extends UserErase {
  /** @type { string } */
  name;

  listNode;
  activeTimeout;

  /** Contains points which were undone so that they can be redone. */
  redoBuffer = new Array();

  constructor(username, isOwnUser = false) {
    super();
    this.name = username;
    this.listNode = this.createUserListNode(username, isOwnUser);
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
  undo(room, count) {
    if (this.undoEraseIndex === 0 && this.posCache.length === 0) return;

    for (let i = 0; i < count; i++) {
      const eraseInfo = this.undoEraseQueue[this.undoEraseIndex - 1];
      if (eraseInfo?.bufferIndex === this.posCache.length - 1) {

        eraseInfo.target.push(eraseInfo.wrapper);
        this.undoEraseIndex--;

      } else if (this.posCache.length > 0) {
        const posDataWrapper = this.posCache.pop();
        this.redoBuffer.push(posDataWrapper);
        room.deleteFromPosBuffer(posDataWrapper);
      } else break;
    }

    room.redrawCanvas();
  }
  /** @param {ScratchetCanvas} room */
  redo(room, count) {
    if (this.undoEraseIndex === this.undoEraseQueue.length && this.redoBuffer.length === 0) {
      return;
    }

    for (let i = 0; i < count; i++) {
      const eraseInfo = this.undoEraseQueue[this.undoEraseIndex];
      if (eraseInfo?.bufferIndex === this.posCache.length - 1) {

        eraseInfo.target.splice(eraseInfo.target.indexOf(eraseInfo.wrapper), 1);
        this.undoEraseIndex++;

      } else if (this.redoBuffer.length > 0) {
        const posDataWrapper = this.redoBuffer.pop();
        this.posCache.push(posDataWrapper);
        room.addToPosBuffer(posDataWrapper);
      } else break;
    }

    room.redrawCanvas();
  }

  clearRedoBuffer() {
    if (this.redoBuffer.length > 0) {
      this.redoBuffer = new Array();
    }
    if (this.undoEraseIndex < this.undoEraseQueue.length) {
      const removedEraseInfo = this.undoEraseQueue.splice(this.undoEraseIndex);

      for (let i = removedEraseInfo.length - 1; i >= 0; i--) {
        const info = removedEraseInfo[i];
        info.target.splice(0, Infinity, ...info.initialData);
      }
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
