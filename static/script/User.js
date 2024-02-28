'use strict';
class User {
  posCache = new Array();

  /**
   * Contains information of erased points so that they can be redone.
   * - Is used in conjunction with {@link undoEraseIndex}.
   * - Grouping info into chunks is done as part of the canvas
   *   as it is only needed for the current user.
   * @type { Array<UndoEraseInfo> }
   */
  undoEraseQueue = new Array();
  /**
   * {@link undoEraseQueue} at this index is the current valid eraser undo/redo step.
   */
  undoEraseIndex = 0;

  /** @type { string } */
  name;

  listNode;
  activeTimeout;

  /** Contains points which were undone so that they can be redone. */
  redoBuffer = new Array();

  historyHandler;
  #posHandler;

  /**
   * @param { string } username
   * @param { PositionDataHandler } posHandler
   */
  constructor(username, posHandler, isOwnUser = false) {
    this.name = username;
    this.#posHandler = posHandler;
    this.listNode = this.createUserListNode(username, isOwnUser);
    this.historyHandler = new HistoryHandler(this);
  }


  setName(newUsername) {
    this.name = newUsername;
    this.listNode.textContent = newUsername;
  }

  setColorIndicator(hue) {
    this.listNode.style.color = Meta.makeHSLString(hue);

    if (this.activeTimeout != null) {
      clearTimeout(this.activeTimeout);
    }
    this.activeTimeout = setTimeout(() => {
      this.listNode.style.removeProperty('color');
      this.activeTimeout = null;
    }, Global.SEND_INTERVAL * 1.5);
  }

  /**
   * @return { boolean } Whether something has been erased.
   */
  erase(posX, posY, eraserWidth) {
    const undoStack = PositionErase.eraseAtPos(this.posCache, ...arguments);
    if (undoStack.length > 0) {
      this.historyHandler.addEraseData(undoStack);
      return true;
    }
    return false;
  }


  // ---- Buffer operations ----
  addToBuffer(posWrapper, initIndex) {
    this.posCache.push(posWrapper);
    this.#posHandler.addToBuffer(posWrapper, initIndex);
  }
  deleteFromBuffer(posWrapper) {
    this.posCache.splice(this.posCache.indexOf(posWrapper), 1);
    this.#posHandler.deleteFromBuffer(posWrapper);
  }
  emptyBuffer() {
    if (this.posCache.length > 0) {
      for (const posWrapper of this.posCache) {
        this.#posHandler.deleteFromBuffer(posWrapper);
      }
      // We may not assign a new array because the HistoryHandler
      // holds a reference to it.
      this.posCache.length = 0;
      this.historyHandler.empty();
      return true;
    } else return false;
  }

  addServerDataToBuffer(posData, wrapperDestIndex) {
    posData = PositionDataHandler.convertServerDataToClientData(posData, this);
    if (posData) {
      this.addClientDataToBuffer(posData, wrapperDestIndex);
    }
  }
  addClientDataToBuffer(posData, wrapperDestIndex) {
    const posDataWrapper = Meta.createPosDataWrapper(posData);
    this.addToBuffer(posDataWrapper, wrapperDestIndex);
  }


  // ---- Events ----
  listNodeMouseEnter() {
    controller.highlightUser(this);
  }
  listNodeMouseLeave() {
    controller.activeRoom.view.update();
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
