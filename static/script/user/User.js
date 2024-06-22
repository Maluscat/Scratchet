import * as Meta from '~/constants/meta.js';
import { controller } from '~/init.js';
import { PositionDataHandler } from '~/PositionDataHandler.js';
import { HistoryHandler } from '~/history/HistoryHandler.js';

export class User {
  posCache = new Array();

  /** @type { string } */
  name;

  inactivePingCount = 0;
  active = true;

  listNode;
  #indicatorTimeout;

  historyHandler;
  posHandler;

  /**
   * @param { string } username
   * @param { PositionDataHandler } posHandler
   */
  constructor(username, posHandler, isOwnUser = false) {
    this.name = username;
    this.posHandler = posHandler;
    this.listNode = this.createUserListNode(username, isOwnUser);
    this.historyHandler = new HistoryHandler(this);
    this.activate();
  }


  setName(newUsername) {
    this.name = newUsername;
    this.listNode.textContent = newUsername;
  }

  setColorIndicator(hue) {
    this.listNode.style.color = Meta.makeHSLString(hue);

    if (this.#indicatorTimeout != null) {
      clearTimeout(this.#indicatorTimeout);
    }
    this.#indicatorTimeout = setTimeout(() => {
      this.listNode.style.removeProperty('color');
      this.#indicatorTimeout = null;
    }, Meta.SEND_INTERVAL * 1.5);
  }

  deactivate() {
    this.active = false;
  }
  activate() {
    this.active = true;
    this.inactivePingCount = 0;
  }


  // ---- Buffer operations ----
  addToBuffer(posWrapper, initIndex) {
    this.posCache.push(posWrapper);
    this.posHandler.addToBuffer(posWrapper, initIndex);
    this.historyHandler.currentBrush.addData(posWrapper);
  }
  deleteFromBuffer(posWrapper) {
    this.posCache.splice(this.posCache.indexOf(posWrapper), 1);
    this.posHandler.deleteFromBuffer(posWrapper);
  }
  emptyBuffer() {
    if (this.posCache.length > 0) {
      for (const posWrapper of this.posCache) {
        this.posHandler.deleteFromBuffer(posWrapper);
      }
      // We may not assign a new array because the HistoryHandler
      // holds a reference to it.
      this.posCache.length = 0;
      this.historyHandler.empty();
      return true;
    } else return false;
  }

  addPosDataToBuffer(posData, wrapperDestIndex) {
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


  // ---- Eraser ----
  /**
   * Erase all points in the given buffer that are in range of the eraser
   * at the given coordinates and size.
   * @param { number } posX The eraser position.x to check against.
   * @param { number } posY The eraser position.y to check against.
   * @param { number } eraserSize The eraser diameter.
   */
  erase(posX, posY, eraserSize) {
    let hasErased = false;

    PositionDataHandler.iteratePosWrapper(this.posCache, ({ posData, wrapperStack, index }) => {
      const posDataWrapper = wrapperStack.at(-2);
      const initialWrapper = [ ...posDataWrapper ];

      let startIdx = Meta.LEN.BRUSH;
      let isErasing = false;

      // j is used as the endIndex
      for (let j = Meta.LEN.BRUSH; j < posData.length; j += 2) {
        if (PositionDataHandler.positionsOverlap(posData[j], posData[j + 1], posX, posY, eraserSize, posData[1])) {
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
        this.historyHandler.currentEraser.addData(posDataWrapper, initialWrapper);
      }
    });

    return hasErased;
  }
}
