'use strict';
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

    this.addBrushGroupsToBuffer(posHandler, buffer, user.historyHandler.getUndoHistory());
    buffer[buffer.length - 1] = Global.MODE.BULK_INIT_HISTORY_MARKER;
    buffer.push(Global.MODE.BULK_INIT); // Will be overridden
    this.addBrushGroupsToBuffer(posHandler, buffer, user.historyHandler.getRedoHistory());

    return buffer;
  }
  static addBrushGroupsToBuffer(posHandler, buffer, groups) {
    for (const group of groups) {
      if (group instanceof BrushGroup) {
        this.addPosWrapperToBuffer(posHandler, buffer, group, Global.MODE.BULK_INIT_BRUSH);
      } else if (group instanceof EraserGroup) {
        this.addPosWrapperToBuffer(posHandler, buffer, group, Global.MODE.BULK_INIT_ERASE);
      }
    }
  }
  static addPosWrapperToBuffer(posHandler, buffer, group, flag) {
    buffer[buffer.length - 1] = flag;

    for (const data of group.historyData) {
      const wrapperDestIndex = posHandler.getPosIndex(data.target);

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
