'use strict';
/**
 * The bulk init buffer is built like this:
 * 0 | -1             # Initial bulk init flag
 * 1 | -10/-11        # Brush or eraser flag
 * 2 | ...PosData
 * 3 | -1             # Marker to separate multiple PosDatas
 * 4 | (repeat 2-3)
 * 5 | ...PosData
 * 6 | (repeat 1-5)
 * 7 | -12            # Marker to denote switch from undo to redo
 * 8 | (repeat 1-5)
 *
 * For example:
 * [ -1, -10, ...PosData, -11, ...PosData, -1, ...PosData, -12, -11, ...PosData, -1 ]
 */
class UserBulkInit extends User {
  #redoCount = 0;

  #eraserData = new Map();
  #isRedo = false;

  /** @param { Array } data */
  handleBulkInit(data) {
    let startIndex = 2;
    let mode = data[1];
    let i = startIndex;

    for (; i < data.length; i++) {
      if (data[i] < 0) {
        this.#handlePosData(mode, data, startIndex, i);
        startIndex = i + 1;
        if (data[i] !== -1) {
          this.#handleGroup(mode);
          mode = data[i];
        }
      }
    }
    this.#handleGroup(mode);

    this.historyHandler.undo(this.#redoCount);
    this.#redoCount = 0;
    this.#isRedo = false;
  }

  #handlePosData(mode, data, startIndex, i) {
    if (startIndex === i) return;
    const [ wrapperDestIndex, posData ] = this.#getPosInfo(data, startIndex, i);

    switch (mode) {
      case Global.MODE.BULK_INIT_BRUSH:
        this.#addPosData(wrapperDestIndex, posData);
        break;
      case Global.MODE.BULK_INIT_ERASE:
        this.#addEraseData(wrapperDestIndex, posData);
        break;
    }
  }
  #handleGroup(mode) {
    if (this.#isRedo) {
      this.#redoCount++;
    }

    switch (mode) {
      case Global.MODE.BULK_INIT_HISTORY_MARKER:
        this.#isRedo = true;
        break;
      case Global.MODE.BULK_INIT_ERASE:
        this.#handleEraseGroup();
        break;
    }
    this.historyHandler.addGroup();
  }
  #handleEraseGroup(data) {
    for (const [ wrapperDestIndex, posWrapper ] of this.#eraserData) {
      const target = this.posHandler.getBufferFromInitIndex(wrapperDestIndex);
      this.historyHandler.addEraseDataUnchecked(target, Array.from(target));
      target.splice(0, target.length, ...posWrapper);
    }

    this.#eraserData.clear();
  }

  #addPosData(wrapperDestIndex, posData) {
    if (!posData) {
      this.addClientDataToBuffer(false, wrapperDestIndex);
    } else {
      this.addServerDataToBuffer(posData, wrapperDestIndex);
    }
  }
  #addEraseData(wrapperDestIndex, posData) {
    posData = PositionDataHandler.convertServerDataToClientData(posData, this);
    if (!this.#eraserData.has(wrapperDestIndex)) {
      this.#eraserData.set(wrapperDestIndex, []);
    }
    this.#eraserData.get(wrapperDestIndex).push(posData);
  }

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

  // ---- Build the bulk init data ----
  static getSendableBuffer(user, posHandler) {
    const buffer = [
      Global.MODE.BULK_INIT,
      Global.MODE.BULK_INIT // Will be overridden
    ];

    user.historyHandler.history.forEach((group, i) => {
      if (i === user.historyHandler.historyIndex) {
        buffer[buffer.length - 1] = Global.MODE.BULK_INIT_HISTORY_MARKER;
        buffer.push(Global.MODE.BULK_INIT); // Will be overridden
      }

      if (group instanceof BrushGroup) {
        this.addPosWrapperToBuffer(posHandler, buffer, group, Global.MODE.BULK_INIT_BRUSH);
      } else if (group instanceof EraserGroup) {
        this.addPosWrapperToBuffer(posHandler, buffer, group, Global.MODE.BULK_INIT_ERASE);
      }
    });

    return buffer;
  }
  static addPosWrapperToBuffer(posHandler, buffer, group, flag) {
    buffer[buffer.length - 1] = flag;

    for (const data of group.historyData) {
      const wrapperDestIndex = posHandler.getPosIndex(data.target);

      if (data.posWrapper.length === 0) {
        buffer.push(wrapperDestIndex, Global.MODE.BULK_INIT);
      } else {
        PositionDataHandler.iteratePosWrapper(data.posWrapper, ({ posData }) => {
          buffer.push(
            wrapperDestIndex,
            ...PositionDataHandler.convertClientDataToServerData(posData),
            Global.MODE.BULK_INIT
          );
        });
      }
    }
  }
}
