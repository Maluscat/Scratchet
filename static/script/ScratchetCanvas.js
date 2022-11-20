'use strict';
class ScratchetCanvas extends ScratchetCanvasControls {
  pressedMouseBtn = -1;
  lastPos = new Array(2);

  /**
   * Contains the posDataWrappers to draw in sequential order.
   */
  posBuffer = new Array();
  /**
   * Contains the "bulk init indexes" / "wrapper destination indexes"
   * for the corresponding entries in {@link posBuffer},
   * so that potentially incoming bulk init user data can be sequenced
   * into the {@link posBuffer} by its indexes, retaining draw order.
   *
   * (TODO) Can be deleted after an approximated timespan
   * when all peer data should have arrived.
   */
  initPosIndexes = new Array();

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
      controller.initializePosBufferErase();
    } else if (this.pressedMouseBtn === 0) {
      const [posX, posY] = this.getPosWithTransform(e.clientX, e.clientY);

      this.setLastPos(posX, posY);
      controller.initializePosBufferNormal(posX, posY);
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
      controller.sendPositionsIfWidthHasChanged();

      const [posX, posY] = this.getPosWithTransform(e.clientX, e.clientY);

      if (this.pressedMouseBtn === 2) {
        if (this.erasePos(posX, posY, this.getOwnUser())) {
          this.redrawCanvas();
          controller.sendCompleteMetaDataNextTime();
          controller.addToPosBuffer(posX, posY);
        }
      } else {
        controller.sendPositionsIfHueHasChanged();

        this.ctx.beginPath();
        this.ctx.moveTo(...this.lastPos);
        this.ctx.lineTo(posX, posY);
        this.ctx.stroke();

        this.setLastPos(posX, posY);

        controller.addToPosBuffer(posX, posY);
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

  // ---- Buffer functions ----
  handleBulkInitData(data, user) {
    let startIndex = BULK_INIT_SEPARATOR_LEN;
    // i == 0 is the bulk init mode indicator (MODE.BULK_INIT) and can be skipped
    for (let i = 1; i < data.length; i++) {
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
  erasePos(posX, posY, user, eraserWidth = this.width) {
    let hasErased = false;
    for (const posDataWrapper of user.posCache) {

      for (let i = 0; i < posDataWrapper.length; i++) {
        const posData = posDataWrapper[i];

        let newPosData = new Array(META_LEN.NORMAL);
        for (let i = 0; i < newPosData.length; i++) {
          newPosData[i] = posData[i];
        }

        for (let j = META_LEN.NORMAL; j < posData.length; j += 2) {
          // Push only the points back into the array which are not in range of the erase pos
          if (Math.abs(posData[j] - posX) > eraserWidth || Math.abs(posData[j + 1] - posY) > eraserWidth) {
            newPosData.push(posData[j], posData[j + 1]);
          } else {
            hasErased = true;
            if (newPosData.length > META_LEN.NORMAL) {
              posDataWrapper.push(new Int16Array(newPosData));
            }
            if (j <= posData.length - META_LEN.NORMAL) {
              newPosData = [posData[0], posData[1], posData[j + 2], posData[j + 3], posData[4]];
            } else {
              newPosData = [];
            }
          }
        }

        if (newPosData.length > META_LEN.NORMAL) {
          posDataWrapper[i] = new Int16Array(newPosData);
        } else {
          posDataWrapper.splice(i, 1);
        }
      }
      if (posDataWrapper.length === 0) {
        this.deleteFromPosBuffer(posDataWrapper);
        user.posCache.delete(posDataWrapper);
      }
    }
    return hasErased;
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
      user.setColorIndicator(getClientMetaHue(posData));
      this.addClientDataToBuffer(posData, user, wrapperDestIndex);
      this.redrawCanvas();
    }
  }
  addClientDataToBuffer(posData, user, wrapperDestIndex) {
    const posDataWrapper = createPosDataWrapper(posData);
    if (wrapperDestIndex != null) {
      const insertIndex = this.getPosDataIndex(wrapperDestIndex);
      this.addToBufferWithInitIndex(posDataWrapper, wrapperDestIndex, insertIndex);
    } else {
      this.addToBufferWithInitIndex(posDataWrapper, Infinity);
    }
    user.posCache.add(posDataWrapper);
  }

  addToBufferWithInitIndex(value, initIndex, insertIndex = Infinity) {
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
      if (flag & 0b0001) {
        clientPosData[0] = clientPosData[1];
        clientPosData[1] = getClientMetaWidth(lastPosData);
      }
      if (flag & 0b0010) {
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

    if ((flag & 0b0001) === 0) {
      serverPosData[extraLen--] = getClientMetaWidth(posData);
    }
    if ((flag & 0b0010) === 0) {
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
