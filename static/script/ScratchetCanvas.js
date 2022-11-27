'use strict';
class ScratchetCanvas extends ScratchetCanvasControls {
  pressedMouseBtn = -1;
  lastPos = new Array(2);

  /**
   * Contains the posDataWrappers to draw in sequential order.
   */
  posBuffer = new Array();
  /**
   * - Contains the "bulk init indexes" / "wrapper destination indexes"
   * for the corresponding entries in {@link posBuffer},
   * so that potentially incoming bulk init user data can be sequenced
   * into the {@link posBuffer} by its indexes, retaining draw order.
   * - Is deleted in the constructor after an approximated timespan
   * when all peer data should have arrived
   */
  initPosIndexes = new Array();
  /**
   * Contains points which were undone so that they can be redone.
   */
  redoBuffer = new Array();

  width = 25;
  hue = 0;

  /**
   * @param { HTMLCanvasElement } canvas
   */
  constructor(canvas) {
    super(canvas);

    canvas.addEventListener('pointerdown', this.canvasDown.bind(this));
    window.addEventListener('pointerup', this.pointerUp.bind(this));
    canvas.addEventListener('pointermove', this.canvasDraw.bind(this));

    this.setStrokeStyle();
    this.setLineWidth();

    this.setTransform();

    setTimeout(() => {
      delete this.initPosIndexes;
    }, Global.MAX_INIT_TRANSMISSION_TIME);
  }

  // ---- Event functions ----
  canvasContext(e) {
    if (e.button === 2) {
      e.preventDefault();
    }
  }

  canvasDown(e) {
    this.pressedMouseBtn = e.button;
    if (this.pressedMouseBtn === 2) {
      ui.toggleDrawIndicatorEraseMode();
      controller.initializeSendBufferErase();
    } else if (this.pressedMouseBtn === 0) {
      const [posX, posY] = this.getPosWithTransform(e.clientX, e.clientY);

      this.setLastPos(posX, posY);
      controller.initializeSendBufferNormal(posX, posY);
    }
    if (e.pointerType !== 'touch') {
      this.canvasDraw(e);
    }
  }

  pointerUp() {
    controller.sendPositions();
    this.pressedMouseBtn = -1;
    ui.toggleDrawIndicatorEraseMode(true);
    this.redrawCanvas();
  }

  canvasDraw(e) {
    if (controls3D.touchIsActive) return;

    this.setCurrentMousePos(e.clientX, e.clientY);
    ui.moveDrawIndicator(e.clientX, e.clientY);

    if (this.pressedMouseBtn === 0 || this.pressedMouseBtn === 2) {
      controller.sendPositionsIfMetaHasChanged();

      const [posX, posY] = this.getPosWithTransform(e.clientX, e.clientY);

      if (this.pressedMouseBtn === 2) {
        if (this.erasePos(posX, posY, this.getOwnUser())) {
          this.redrawCanvas();
          controller.sendCompleteMetaDataNextTime();
          controller.addToSendBuffer(posX, posY);
        }
      } else {
        this.ctx.beginPath();
        this.ctx.moveTo(...this.lastPos);
        this.ctx.lineTo(posX, posY);
        this.ctx.stroke();

        this.setLastPos(posX, posY);

        controller.addToSendBuffer(posX, posY);
      }
    }
  }

  // ---- Canvas handling ----
  redrawCanvas(userHighlight) {
    // TODO skip unseen points
    this.ctx.clearRect(0, 0, ScratchetCanvasControls.VIEW_WIDTH, ScratchetCanvasControls.VIEW_HEIGHT);

    let hasChanged = true;
    for (var i = 0; i < this.posBuffer.length; i++) {
      const posDataWrapper = this.posBuffer[i];
      const nextWrapper = this.posBuffer[i + 1];
      let isFromHighlightedUser = false;

      if (userHighlight != null) {
        isFromHighlightedUser = !userHighlight.posCache.has(posDataWrapper);
      }
      if (hasChanged) {
        // ASSUMPTION: all posData in posDataWrapper have the same width and hue
        // because only the eraser can form multiple posData inside one wrapper
        this.setStrokeStyle(getClientMetaHue(posDataWrapper[0]), isFromHighlightedUser);
        this.setLineWidth(getClientMetaWidth(posDataWrapper[0]));

        this.ctx.beginPath();
        hasChanged = false;
      }

      this.drawFromPosDataWrapper(posDataWrapper);

      if (!nextWrapper
          || getClientMetaHue(nextWrapper[0]) !== getClientMetaHue(posDataWrapper[0])
          || getClientMetaWidth(nextWrapper[0]) !== getClientMetaWidth(posDataWrapper[0])
            /* This forces a stroke when changing from one user to another with highlight enabled */
          || userHighlight != null && (!userHighlight.posCache.has(nextWrapper) !== isFromHighlightedUser)) {
        this.ctx.stroke();
        hasChanged = true;
      }
    }
    this.setStrokeStyle();
    this.setLineWidth();
  }

  drawFromPosDataWrapper(posDataWrapper) {
    for (const posData of posDataWrapper) {
      this.ctx.moveTo(posData[2], posData[3]);
      let i = META_LEN.NORMAL;
      for (; i < posData.length - 4; i += 6) {
        this.ctx.bezierCurveTo(posData[i], posData[i + 1], posData[i + 2], posData[i + 3], posData[i + 4], posData[i + 5]);
      }
      // Draw the finishing points of the wrapper in case the wrapper hasn't fully been drawn above
      if (i === posData.length - 4) {
        this.ctx.quadraticCurveTo(posData[i], posData[i + 1], posData[i + 2], posData[i + 3]);
      } else if (i === posData.length - 2) {
        this.ctx.lineTo(posData[i], posData[i + 1]);
      }
    }
  }

  // ---- Pos buffer ----
  setLastPos(posX, posY) {
    this.lastPos[0] = posX;
    this.lastPos[1] = posY;
  }

  // ---- Undo/redo ----
  /** @param {ScratchetUser} user */
  undoPoint(user) {
    if (user.posCache.size > 0) {
      const posData = Array.from(user.posCache).at(-1);
      user.posCache.delete(posData);
      this.deleteFromPosBuffer(posData);
      this.redoBuffer.push(posData);
      this.redrawCanvas();
    }
  }
  /** @param {ScratchetUser} user */
  redoPoint(user) {
    if (this.redoBuffer.length > 0) {
      const posData = this.redoBuffer.pop();
      user.posCache.add(posData);
      this.addToBuffer(posData);
      this.redrawCanvas();
    }
  }

  clearRedoBuffer() {
    this.redoBuffer = new Array();
  }

  // ---- Buffer functions ----
  handleBulkInitData(data, user) {
    let startIndex = BULK_INIT_SEPARATOR_LEN;
    for (let i = startIndex; i < data.length; i++) {
      if (data[i] === Global.MODE.BULK_INIT) {
        this.sliceInitDataAndAddToBuffer(data, user, startIndex, i);
        startIndex = i + BULK_INIT_SEPARATOR_LEN;
      }
    }
    this.sliceInitDataAndAddToBuffer(data, user, startIndex);
    this.redrawCanvas();
  }
  sliceInitDataAndAddToBuffer(data, user, startIndex, endIndex = Infinity) {
    const posData = data.subarray(startIndex, endIndex);
    const wrapperDestIndex = data[startIndex - BULK_INIT_SEPARATOR_LEN + 1];
    this.addServerDataToBuffer(posData, user, wrapperDestIndex);
  }

  handleEraseData(data, user) {
    for (let i = META_LEN.ERASE; i < data.length; i += 2) {
      this.erasePos(data[i], data[i + 1], user, getClientMetaWidth(data));
    }
    this.redrawCanvas();
  }
  erasePos(targetPosX, targetPosY, user, eraserWidth = this.width) {
    let hasChanged = false;
    for (const posDataWrapper of user.posCache) {

      for (let i = 0; i < posDataWrapper.length; i++) {
        const posData = posDataWrapper[i];
        let startIdx = META_LEN.NORMAL;

        // Also check and potentially overwrite the moveTo anchor
        if (posIsInEraseRange(posData[2], posData[3], posData[1])) {
          posData[2] = posData[5];
          posData[3] = posData[6];
          hasChanged = true;
        }

        for (let j = META_LEN.NORMAL; j < posData.length; j += 2) {
          if (posIsInEraseRange(posData[j], posData[j + 1], posData[1])) {
            // j is used as the endIndex
            if (startIdx !== -1) {
              if (startIdx !== j) {
                const newPosData = createNewPosData(posData, startIdx, j);
                posDataWrapper.push(newPosData);
              }
              hasChanged = true;
              startIdx = -1;
            }
          } else if (startIdx === -1) {
            startIdx = j;
          }
        }

        // Cleanup; If the last position in posData stayed intact
        // (Which the above loop skipped)
        if (startIdx !== -1 && posData.length > startIdx) {
          if (startIdx > META_LEN.NORMAL) {
            const newPosData = createNewPosData(posData, startIdx);
            posDataWrapper[i] = newPosData;
            hasChanged = true;
          }
        } else {
          posDataWrapper.splice(i, 1);
        }
      }

      if (posDataWrapper.length === 0) {
        this.deleteFromPosBuffer(posDataWrapper);
        user.posCache.delete(posDataWrapper);
      }
    }
    return hasChanged;

    function posIsInEraseRange(testPosX, testPosY, strokeWidth) {
      const distance = Math.sqrt(
            Math.pow(targetPosX - testPosX, 2)
          + Math.pow(targetPosY - testPosY, 2))
        - (eraserWidth / 2)
        - (strokeWidth / 2);
      return distance <= 0;
    }

    // Create new Int16Array from a start index to end index of posData
    function createNewPosData(originalPosData, startIdx, endIdx = originalPosData.length) {
      // The first sub array retains its original metadata, so we can just excerpt it
      if (startIdx === META_LEN.NORMAL) {
        return originalPosData.subarray(0, endIdx);
      } else {
        const newPosData = new Int16Array((endIdx - startIdx) + META_LEN.NORMAL);
        newPosData[0] = originalPosData[0];
        newPosData[1] = originalPosData[1];
        newPosData[2] = originalPosData[startIdx];
        newPosData[3] = originalPosData[startIdx + 1];
        for (let i = 0; i < newPosData.length - META_LEN.NORMAL; i++) {
          newPosData[i + META_LEN.NORMAL] = originalPosData[startIdx + i];
        }
        return newPosData;
      }
    }
  }

  sendJoinedUserBuffer() {
    const userCache = this.getOwnUser().posCache;
    if (userCache.size > 0) {
      const joinedBuffer = [this.roomCode];
      for (const posDataWrapper of userCache) {
        const wrapperDestIndex = this.posBuffer.indexOf(posDataWrapper);
        for (const posData of posDataWrapper) {
          joinedBuffer.push(
            Global.MODE.BULK_INIT,
            wrapperDestIndex,
            ...this.convertClientDataToServerData(posData));
        }
      }
      sock.send(new Int16Array(joinedBuffer));
    }
  }

  clearUserBufferAndRedraw(user) {
    if (user.posCache.size > 0) {
      for (const posDataWrapper of user.posCache) {
        this.deleteFromPosBuffer(posDataWrapper);
      }
      user.posCache.clear();
      this.redrawCanvas();
    }
  }

  addServerDataToBuffer(posData, user, wrapperDestIndex) {
    posData = this.convertServerDataToClientData(posData, user);
    if (posData) {
      this.addClientDataToBuffer(posData, user, wrapperDestIndex);
    }
  }
  addServerDataToBufferAndDraw(posData, user) {
    user.setColorIndicator(getClientMetaHue(posData));
    this.addServerDataToBuffer(posData, user);
    this.redrawCanvas();
  }

  addClientDataToBuffer(posData, user, wrapperDestIndex) {
    const posDataWrapper = createPosDataWrapper(posData);
    if (wrapperDestIndex != null && this.initPosIndexes) {
      const insertIndex = this.getPosDataIndex(wrapperDestIndex);
      this.addToBuffer(posDataWrapper, wrapperDestIndex, insertIndex);
    } else {
      this.addToBuffer(posDataWrapper);
    }
    this.clearRedoBuffer();
    user.posCache.add(posDataWrapper);
  }

  /**
   * Add a posDataWrapper to the {@link posBuffer} with an optional init index,
   * at an optional array position.
   * @param {Array<Array<number>>} value The posDataWrapper to insert.
   * @param {number} [initIndex = Infinity] The init index of the posDataWrapper.
   * @param {number} [insertIndex = Infinity] The array index to insert value at.
   */
  addToBuffer(value, initIndex = Infinity, insertIndex = Infinity) {
    // insertIndex === Infinity is equivalent to `Array.push`
    if (this.initPosIndexes) {
      this.initPosIndexes.splice(insertIndex, 0, initIndex);
    }
    this.posBuffer.splice(insertIndex, 0, value);
  }

  // ---- Protocol converter ----
  convertServerDataToClientData(posData, user) {
    const flag = posData[0];
    const extraLen = getExtraMetaLengthFromFlag(flag);

    const clientPosData = new Int16Array(posData.length + extraLen);
    clientPosData.set(posData, extraLen);
    // Shift items to the left
    for (let i = extraLen; i < META_LEN.NORMAL - 1; i++) {
      clientPosData[i] = clientPosData[i + 1];
    }

    if (extraLen > 0) {
      if (user.posCache.size === 0) {
        return false;
      }

      const posCacheArr = Array.from(user.posCache);
      const lastPosData = posCacheArr[posCacheArr.length - 1][0];

      // Get width/hue of the last package
      if (flag & META_FLAGS.LAST_WIDTH) {
        clientPosData[0] = clientPosData[1];
        clientPosData[1] = getClientMetaWidth(lastPosData);
      }
      if (flag & META_FLAGS.LAST_HUE) {
        clientPosData[0] = getClientMetaHue(lastPosData);
      }
    }

    clientPosData[4] = flag;

    return clientPosData;
  }
  convertClientDataToServerData(posData) {
    const flag = posData[4];
    let extraLen = getExtraMetaLengthFromFlag(flag);

    const serverPosData = new Int16Array(posData.length - extraLen);
    serverPosData.set(posData.subarray(extraLen));
    // Shift items to the right
    for (let i = META_LEN.NORMAL - extraLen - 1 - 1; i >= 0; i--) {
      serverPosData[i + 1] = serverPosData[i];
    }

    if ((flag & META_FLAGS.LAST_WIDTH) === 0) {
      serverPosData[extraLen--] = getClientMetaWidth(posData);
    }
    if ((flag & META_FLAGS.LAST_HUE) === 0) {
      serverPosData[extraLen--] = getClientMetaHue(posData);
    }

    serverPosData[0] = flag;

    return serverPosData;
  }

  // ---- Helper functions ----
  /**
   * Simple binary search. Returns the desired position of the input number.
   * (Inspired by https://stackoverflow.com/a/50612218).
   * @param {number} wrapperDestIndex The bulk init index to get the position of.
   * @return {number} An {@link initPosIndexes} index.
   */
  getPosDataIndex(wrapperDestIndex) {
    let start = 0;
    let end = this.initPosIndexes.length - 1;
    while (start <= end) {
      const mid = Math.floor((start + end) / 2);

      if (this.initPosIndexes[mid] === wrapperDestIndex) {
        return mid;
      }

      if (wrapperDestIndex < this.initPosIndexes[mid]) {
        end = mid - 1;
      } else {
        start = mid + 1;
      }
    }
    return end + 1;
  }
  deleteFromPosBuffer(item) {
    this.posBuffer.splice(this.posBuffer.indexOf(item), 1);
  }

  setLineWidth(width = this.width) {
    this.ctx.lineWidth = width;
  }
  setStrokeStyle(hue = this.hue, hasReducedAlpha) {
    this.ctx.strokeStyle = makeHSLString(hue, hasReducedAlpha);
  }
}
