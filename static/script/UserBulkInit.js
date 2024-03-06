'use strict';
class UserBulkInit extends User {
  #redoCount = 0;

  #eraserData = new Map();

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
  }

  #handlePosData(mode, data, startIndex, i) {
    const [ wrapperDestIndex, posData ] = this.#getPosInfo(data, startIndex, i);

    if (mode === Global.MODE.BULK_INIT_BRUSH_REDO || mode === Global.MODE.BULK_INIT_BRUSH_UNDO) {
      this.#addPosData(wrapperDestIndex, posData);
    } else {
      this.#addEraseData(wrapperDestIndex, posData);
    }
  }
  #handleGroup(mode) {
    if (mode === Global.MODE.BULK_INIT_ERASE_UNDO || mode === Global.MODE.BULK_INIT_ERASE_REDO) {
      this.#handleEraseGroup();
    }
    if (mode === Global.MODE.BULK_INIT_BRUSH_REDO || mode === Global.MODE.BULK_INIT_ERASE_REDO) {
      this.#redoCount++;
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

    // We take advantage of the fact that the data of a brush group is always continuous.
    this.addBrushGroupsToBuffer(
      posHandler, buffer, user.historyHandler.getUndoHistory(), true);
    this.addBrushGroupsToBuffer(
      posHandler, buffer, user.historyHandler.getRedoHistory());

    return buffer;
  }
  static addBrushGroupsToBuffer(posHandler, buffer, groups, isUndo) {
    for (const group of groups) {
      if (group instanceof BrushGroup) {
        const groupFlag = isUndo
          ? Global.MODE.BULK_INIT_BRUSH_UNDO
          : Global.MODE.BULK_INIT_BRUSH_REDO;
        buffer[buffer.length - 1] = groupFlag;

        this.addPosWrapperToBuffer(posHandler, buffer, group);
      } else if (group instanceof EraserGroup) {
        const groupFlag = isUndo
          ? Global.MODE.BULK_INIT_ERASE_UNDO
          : Global.MODE.BULK_INIT_ERASE_REDO;
        buffer[buffer.length - 1] = groupFlag;

        this.addPosWrapperToBuffer(posHandler, buffer, group);
      }
    }
  }
  static addPosWrapperToBuffer(posHandler, buffer, group) {
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
