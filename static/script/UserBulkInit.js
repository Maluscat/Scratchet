'use strict';
class UserBulkInit extends User {
  #brushRedoCount = 0;

  /** @param { Array } data */
  handleBulkInit(data) {
    let startIndex = 2;
    let mode = data[1];
    let i = startIndex;

    for (; i < data.length; i++) {
      if (data[i] < 0) {
        this.#handlePosData(data, startIndex, i);
        startIndex = i + 1;
        if (data[i] !== -1) {
          this.#handleGroup(mode);
          mode = data[i];
        }
      }
    }
    this.#handleGroup(mode);

    this.historyHandler.undo(this.#brushRedoCount);
    this.#brushRedoCount = 0;
  }

  #handlePosData(data, startIndex, i) {
    this.#addPosData(data, startIndex, i);
  }
  #handleGroup(mode) {
    if (mode === Global.MODE.BULK_INIT_BRUSH_REDO || mode === Global.MODE.BULK_INIT_BRUSH_UNDO) {
      this.#addBrushGroup();
      if (mode === Global.MODE.BULK_INIT_BRUSH_REDO) {
        this.#incrementBrushRedo();
      }
    }
  }

  #addBrushGroup() {
    this.historyHandler.addGroup();
  }
  #incrementBrushRedo() {
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
    const buffer = [
      Global.MODE.BULK_INIT,
      Global.MODE.BULK_INIT // Will be overridden
    ];

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
        buffer[buffer.length - 1] = groupFlag;

        for (const info of group.historyData) {
          const wrapperDestIndex = posHandler.getPosIndex(info.target);

          PositionDataHandler.iteratePosWrapper(info.data, ({ posData }) => {
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
}
