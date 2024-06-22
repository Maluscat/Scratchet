import * as Meta from '~/constants/meta.js';
import { BULK_INIT_SEPARATOR_LEN, MAX_PERCEIVED_TIMEOUT_PINGS } from '~/constants/misc.js';
import { PositionDataHandler } from '~/PositionDataHandler.js';
import { BrushGroup } from '~/history/BrushGroup.js';
import { EraserGroup } from '~/history/EraserGroup.js';
import { User } from '~/user/User.js';

/**
 * @typedef
 *   { typeof Meta.MODE.BULK_INIT
 *   | typeof Meta.MODE.BULK_INIT_BRUSH
 *   | typeof Meta.MODE.BULK_INIT_ERASE
 *   | typeof Meta.MODE.BULK_INIT_HISTORY_MARKER } BulkInitModes
 */

/**
 * Handling and sending the bulk init data which every new user
 * receives from every connected user with a non-empty history.
 *
 * The bulk init buffer is built like this:
 * 0 | -1             # Initial bulk init flag
 * 1 | -10/-11        # Brush group or eraser group flag
 * 2 | ...PosDataW
 * 3 | -1             # Marker to separate multiple PosDataWs*
 * 4 | (repeat 2-3)
 * 5 | ...PosDataW
 * 6 | (repeat 1-5)
 * 7 | -12            # Marker to denote switch from undo to redo
 * 8 | (repeat 1-5)
 *
 * * In which every (...PosDataW) denotes a PosData prepended by a wrapperDestIndex
 * which references the destination of the data in the target posBuffer.
 *
 * For example:
 * [ -1, -10, ...PosDataW, -1, ...PosDataW, -11, ...PosDataW, -12, -11, ...PosDataW, -1 ]
 *
 * which, when explicitly denoting wrapperDestIndex, can expand to:
 * [ -1, -10, 0, ...PosData, -1, 1, ...PosData, -11, 0, ...PosData, -12, -11, 0, ...PosData, -1 ]
 *       ^                                      ^                   ^    ^
 *       |                                      |                   |  One eraser group...
 *  One brush group with two PosDatas of        |                   |
 *  destination index 0 and 1 respectively      |    From here on, everything is a redo
 *                                              |
 *                         One eraser group erasing the specified
 *                         PosData of the PosData at destination index 0
 */
export class UserBulkInit extends User {
  #redoCount = 0;

  #eraserData = new Map();

  #handledFirstGroup = false;
  #isRedo = false;

  /** @param { Array } data */
  handleBulkInit(data) {
    let startIndex = 2;
    /** @type { BulkInitModes } */
    let mode = data[1];

    for (let i = startIndex; i < data.length; i++) {
      if (data[i] < 0) {
        this.#handlePosData(mode, data, startIndex, i);
        startIndex = i + 1;
        if (data[i] !== -1) {
          this.#handleMode(mode);
          mode = data[i];
        }
      }
    }
    this.#handleMode(mode);

    this.historyHandler.undo(this.#redoCount);
    this.#redoCount = 0;
    this.#isRedo = false;
    this.#handledFirstGroup = false;
  }

  /** @param { BulkInitModes } mode */
  #handlePosData(mode, data, startIndex, i) {
    if (startIndex === i) return;
    const [ wrapperDestIndex, posData ] = this.#getPosInfo(data, startIndex, i);

    switch (mode) {
      case Meta.MODE.BULK_INIT_BRUSH:
        this.addPosDataToBuffer(posData, wrapperDestIndex);
        break;
      case Meta.MODE.BULK_INIT_ERASE:
        this.#addEraseData(wrapperDestIndex, posData);
        break;
    }
  }
  /** @param { BulkInitModes } mode */
  #handleMode(mode) {
    if (this.#isRedo) {
      this.#redoCount++;
    }

    let usedGroup;
    switch (mode) {
      case Meta.MODE.BULK_INIT_HISTORY_MARKER:
        this.#isRedo = true;
        return;
      case Meta.MODE.BULK_INIT_BRUSH:
        usedGroup = this.historyHandler.currentBrush;
        break;
      case Meta.MODE.BULK_INIT_ERASE:
        usedGroup = this.historyHandler.currentEraser;
        this.#prepareEraseGroup();
        break;
    }

    if (usedGroup) {
      usedGroup.close(Infinity);
      if (this.#handledFirstGroup === false) {
        this.#dropInitialOverlappingHistory(usedGroup);
        this.#handledFirstGroup = true;
      }
      this.historyHandler.addGroup(Infinity);
    }
  }

  #prepareEraseGroup() {
    for (const [ wrapperDestIndex, posWrapper ] of this.#eraserData) {
      const target = this.posHandler.getBufferFromInitIndex(wrapperDestIndex);
      this.historyHandler.currentEraser.addDataUnchecked(target, Array.from(target));
      target.splice(0, target.length, ...posWrapper);
    }

    this.#eraserData.clear();
  }

  #addEraseData(wrapperDestIndex, posData) {
    if (!this.#eraserData.has(wrapperDestIndex)) {
      this.#eraserData.set(wrapperDestIndex, []);
    }
    this.#eraserData.get(wrapperDestIndex).push(posData);
  }

  /** @return { [ number, (number | false) ] } posInfo */
  #getPosInfo(data, startIndex, endIndex) {
    const wrapperDestIndex = data[startIndex];
    startIndex += BULK_INIT_SEPARATOR_LEN - 1;
    if (startIndex === endIndex) {
      return [ wrapperDestIndex, false ];
    } else {
      const posData = data.subarray(startIndex, endIndex);
      return [ wrapperDestIndex, posData ];
    }
  }

  /**
   * Cut everything off the history from the first index
   * at which a history's group is equal to the given group,
   * searching from most to least recent.
   *
   * Only so much groups are searched that reflect the maximum time it could
   * have taken for a timeout to be perceived ({@link MAX_PERCEIVED_TIMEOUT_PINGS}).
   * @param { EraserGroup | BrushGroup } group
   */
  #dropInitialOverlappingHistory(group) {
    const lowestIndex = this.historyHandler.getLastIntactGroupIndex(MAX_PERCEIVED_TIMEOUT_PINGS + 1);
    if (lowestIndex !== false) {
      let equalIndex;
      for (let i = this.historyHandler.history.length - 1; i >= lowestIndex; i--) {
        const currentGroup = this.historyHandler.history[i];
        if (group.equal(currentGroup)) {
          equalIndex = i;
          break;
        }
      }
      if (equalIndex != null) {
        this.historyHandler.undo(this.historyHandler.history.length - equalIndex);
        this.historyHandler.clear();
      }
    }
  }

  // ---- Bulk init data builder ----
  /**
   * Get a bulk init buffer of the given history range for the specified user.
   * @param { UserBulkInit } user
   * @param { PositionDataHandler } posHandler
   */
  static getSendableBuffer(user, posHandler, historyStartIndex = 0) {
    const buffer = [
      Meta.MODE.BULK_INIT,
      Meta.MODE.BULK_INIT // Will be overridden
    ];

    for (let i = historyStartIndex; i < user.historyHandler.history.length; i++) {
      const group = user.historyHandler.history[i];
      if (i === user.historyHandler.historyIndex) {
        buffer[buffer.length - 1] = Meta.MODE.BULK_INIT_HISTORY_MARKER;
        buffer.push(Meta.MODE.BULK_INIT); // Will be overridden
      }

      if (group instanceof BrushGroup) {
        this.#addPosWrapperToBuffer(posHandler, buffer, group, Meta.MODE.BULK_INIT_BRUSH);
      } else if (group instanceof EraserGroup) {
        this.#addPosWrapperToBuffer(posHandler, buffer, group, Meta.MODE.BULK_INIT_ERASE);
      }
    }

    return buffer;
  }
  static #addPosWrapperToBuffer(posHandler, buffer, group, flag) {
    buffer[buffer.length - 1] = flag;

    for (const data of group.historyData) {
      const wrapperDestIndex = posHandler.getPosIndex(data.target);

      if (data.posWrapper.length === 0) {
        buffer.push(wrapperDestIndex, Meta.MODE.BULK_INIT);
      } else {
        PositionDataHandler.iteratePosWrapper(data.posWrapper, ({ posData }) => {
          buffer.push(
            wrapperDestIndex,
            ...posData,
            Meta.MODE.BULK_INIT
          );
        });
      }
    }
  }
}
