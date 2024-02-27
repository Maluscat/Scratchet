'use strict';
class BulkInitHandler {
  #brushRedoCount = 0;


  /**
   * @param { Array } data
   * @param { ScratchetUser } user
   */
  receive(data, user) {
    let startIndex = 1;
    let mode = Global.MODE.BULK_INIT;
    let i = startIndex;

    for (; i < data.length; i++) {
      if (data[i] < 0) {
        this.bulkInitLoop(mode, data, user, startIndex, i);
        startIndex = i + 1;
        mode = data[i];
      }
    }
    this.bulkInitLoop(mode, data, user, startIndex, i);
    user.historyHandler.undo(this.#brushRedoCount);
    this.#brushRedoCount = 0;
  }
  bulkInitLoop(mode, data, user, startIndex, i) {
    switch (mode) {
      case Global.MODE.BULK_INIT_BRUSH_REDO:
        this.#incrementBrushRedo(data, user);
      case Global.MODE.BULK_INIT_BRUSH_UNDO:
        this.#addBrushGroup(data, user);
        break;
      default:
        this.#addPosData(data, user, startIndex, i);
    }
  }

  #addBrushGroup(data, user) {
    user.historyHandler.addGroup();
  }
  #incrementBrushRedo(data, user) {
    this.#brushRedoCount++;
  }
  #addPosData(data, user, startIndex, endIndex) {
    const wrapperDestIndex = data[startIndex];
    startIndex += BULK_INIT_SEPARATOR_LEN - 1;
    if (startIndex === endIndex) {
      user.addClientDataToBuffer(false, wrapperDestIndex);
    } else {
      const posData = data.subarray(startIndex, endIndex);
      user.addServerDataToBuffer(posData, wrapperDestIndex);
    }
  }
}
