'use strict';
class UserBulkInit extends User {
  #brushRedoCount = 0;

  /** @param { Array } data */
  handleBulkInit(data) {
    let startIndex = 1;
    let mode = Global.MODE.BULK_INIT;
    let i = startIndex;

    for (; i < data.length; i++) {
      if (data[i] < 0) {
        this.#handleOperation(mode, data, startIndex, i);
        startIndex = i + 1;
        mode = data[i];
      }
    }
    this.#handleOperation(mode, data, startIndex, i);
    this.historyHandler.undo(this.#brushRedoCount);
    this.#brushRedoCount = 0;
  }
  #handleOperation(mode, data, startIndex, i) {
    switch (mode) {
      case Global.MODE.BULK_INIT_BRUSH_REDO:
        this.#incrementBrushRedo(data);
      case Global.MODE.BULK_INIT_BRUSH_UNDO:
        this.#addBrushGroup(data);
        break;
      default:
        this.#addPosData(data, startIndex, i);
    }
  }

  #addBrushGroup(data) {
    this.historyHandler.addGroup();
  }
  #incrementBrushRedo(data) {
    this.#brushRedoCount++;
  }
  #addPosData(data, startIndex, endIndex) {
    const wrapperDestIndex = data[startIndex];
    startIndex += BULK_INIT_SEPARATOR_LEN - 1;
    if (startIndex === endIndex) {
      this.addClientDataToBuffer(false, wrapperDestIndex);
    } else {
      const posData = data.subarray(startIndex, endIndex);
      this.addServerDataToBuffer(posData, wrapperDestIndex);
    }
  }


  // ---- Build the bulk init data ----
  static getSendableBuffer(user, posHandler) {
    const buffer = [];

    // We take advantage of the fact that the data of a brush group is always continuous.
    this.addBrushGroupsToBuffer(
      posHandler, buffer, Global.MODE.BULK_INIT_BRUSH_UNDO, user.historyHandler.getUndoHistory());
    this.addBrushGroupsToBuffer(
      posHandler, buffer, Global.MODE.BULK_INIT_BRUSH_REDO, user.historyHandler.getRedoHistory());

    return buffer;
  }
  static addBrushGroupsToBuffer(posHandler, buffer, groupFlag, groups) {
    for (const group of groups) {
      if (group instanceof BrushGroup) {
        for (const info of group.redoData) {
          const wrapperDestIndex = posHandler.getPosIndex(info.target);

          PositionDataHandler.iteratePosWrapper(info.data, ({ posData }) => {
            buffer.push(
              Global.MODE.BULK_INIT,
              wrapperDestIndex,
              ...PositionDataHandler.convertClientDataToServerData(posData));
          });
        }

        buffer.push(groupFlag);
      }
    }
  }
}
