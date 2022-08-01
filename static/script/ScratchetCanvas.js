class ScratchetCanvas {
  canvas;
  ctx;

  pressedMouseBtn = -1;
  globalPosBuffer = new Set(); // Set<posDataWrapperInDrawOrder>
  posUserCache = new Map(); // Map<userID, Set<posDataWrapperForUser>>
  lastPos = new Array(2);

  width = 25;
  hue = 0;

  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');

    canvas.addEventListener('contextmenu', this.canvasContext.bind(this));
    canvas.addEventListener('pointerdown', this.canvasDown.bind(this));
    window.addEventListener('pointerup', this.pointerUp.bind(this));
    canvas.addEventListener('pointermove', this.canvasDraw.bind(this));

    this.setDimensions();

    this.setStrokeStyle();
    this.setLineWidth();
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
      toggleDrawIndicatorEraseMode();
      controller.initializePosBufferErase(this.width);
    } else {
      this.setLastPos(e.clientX, e.clientY);
      controller.initializePosBufferNormal(...this.lastPos);
    }
    this.canvasDraw(e);
  }

  pointerUp() {
    controller.sendPositions();
    this.pressedMouseBtn = -1;
    toggleDrawIndicatorEraseMode(true);
  }

  canvasDraw(e) {
    moveDrawIndicator(e.clientX, e.clientY);
    if (this.pressedMouseBtn >= 0) {
      controller.sendPositionsIfWidthHasChanged();

      if (this.pressedMouseBtn === 2) {
        if (this.erasePos(e.clientX, e.clientY, CURRENT_USER_ID)) {
          this.redrawCanvas();
          controller.sendCompleteMetaDataNextTime();
          controller.addToPosBuffer(e.clientX, e.clientY);
        }
      } else {
        controller.sendPositionsIfHueHasChanged();

        this.ctx.beginPath();
        this.ctx.moveTo(...this.lastPos);
        this.ctx.lineTo(e.clientX, e.clientY);
        this.ctx.stroke();

        this.setLastPos(e.clientX, e.clientY);

        controller.addToPosBuffer(e.clientX, e.clientY);
      }
    }
  }

  // ---- Canvas handling ----
  redrawCanvas(userPosSetHighlight) {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    const globalPosBufferArr = Array.from(this.globalPosBuffer);
    let hasChanged = true;
    for (var i = 0; i < globalPosBufferArr.length; i++) {
      const posDataWrapper = globalPosBufferArr[i];
      const nextWrapper = globalPosBufferArr[i + 1];
      if (hasChanged) {
        const hasReducedAlpha = userPosSetHighlight && !userPosSetHighlight.has(posDataWrapper);
        // ASSUMPTION: all posData in posDataWrapper have the same width and hue
        // because only the eraser can form multiple posData inside one wrapper
        this.setStrokeStyle(getClientMetaHue(posDataWrapper[0]), hasReducedAlpha);
        this.setLineWidth(getClientMetaWidth(posDataWrapper[0]));

        this.ctx.beginPath();
        hasChanged = false;
      }

      this.drawFromPosDataWrapper(posDataWrapper);

      if (!nextWrapper
          || getClientMetaHue(nextWrapper[0]) !== getClientMetaHue(posDataWrapper[0])
          || getClientMetaWidth(nextWrapper[0]) !== getClientMetaWidth(posDataWrapper[0])) {
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

  clearCurrentUserCanvas() {
    this.clearUserBufferAndRedraw(CURRENT_USER_ID);
  }

  // ---- Pos buffer ----
  setLastPos(posX, posY) {
    this.lastPos[0] = posX;
    this.lastPos[1] = posY;
  }

  // ---- Buffer functions ----
  handleBulkInitData(data, userID) {
    let index = 1;
    for (let i = 1; i < data.length; i++) {
      if (data[i] === MODE.BULK_INIT) {
        this.addServerDataToBuffer(data.subarray(index, i), userID);
        index = i + 1;
      }
    }
    this.addServerDataToBuffer(data.subarray(index), userID);
    this.redrawCanvas();
  }
  handleEraseData(data, userID) {
    if (this.posUserCache.has(userID)) {
      const userPosSet = this.posUserCache.get(userID);
      for (let i = META_LEN.ERASE; i < data.length; i += 2) {
        this.erasePos(data[i], data[i + 1], userID, userPosSet, getClientMetaWidth(data));
      }
      this.redrawCanvas();
    }
  }
  erasePos(posX, posY, userID, userPosSet, eraserWidth = this.width) {
    if (!userPosSet) {
      if (!this.posUserCache.has(userID)) return;
      userPosSet = this.posUserCache.get(userID);
    }
    let hasErased = false;
    for (const posDataWrapper of userPosSet) {

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
        this.globalPosBuffer.delete(posDataWrapper);
        this.posUserCache.get(userID).delete(posDataWrapper);
      }
    }
    return hasErased;
  }

  sendJoinedUserBuffer(targetUserID) {
    if (this.posUserCache.has(CURRENT_USER_ID)) {
      const joinedBuffer = new Array();
      for (const posDataWrapper of this.posUserCache.get(CURRENT_USER_ID)) {
        for (const posData of posDataWrapper) {
          joinedBuffer.push(MODE.BULK_INIT, ...this.convertClientDataToServerData(posData));
        }
      }
      sock.send(new Int16Array(joinedBuffer));
    }
  }

  clearUserBufferAndRedraw(userID) {
    const userCache = this.posUserCache.get(userID);
    if (userCache) {
      for (const posDataWrapper of userCache) {
        this.globalPosBuffer.delete(posDataWrapper);
      }
      userCache.clear();
    }
    this.redrawCanvas();
  }

  addServerDataToBuffer(posData, userID) {
    if (!this.posUserCache.has(userID)) {
      throw new Error(`User #${userID} unknown!`);
    }

    posData = this.convertServerDataToClientData(posData, userID);
    if (posData) {
      this.nameHandler.setUserColorIndicator(userID, getClientMetaHue(posData));
      this.addClientDataToBuffer(posData, userID);
      this.redrawCanvas();
    }
  }
  addClientDataToBuffer(posData, userID) {
    const posDataWrapper = createPosDataWrapper(posData);
    this.globalPosBuffer.add(posDataWrapper);
    this.posUserCache.get(userID).add(posDataWrapper);
  }

  // ---- Protocol converter ----
  convertServerDataToClientData(posData, userID) {
    const flag = posData[0];
    const extraLen = getExtraMetaLengthFromFlag(flag);

    const clientPosData = new Int16Array(posData.length + extraLen);
    clientPosData.set(posData, extraLen);
    // Shift items to the left
    for (let i = extraLen; i < META_LEN.NORMAL - 1; i++) {
      clientPosData[i] = clientPosData[i + 1];
    }

    if (extraLen > 0) {
      let userPosSet = this.posUserCache.get(userID);
      if (userPosSet.size === 0) {
        return false;
      }

      userPosSet = Array.from(userPosSet);
      const lastPosData = userPosSet[userPosSet.length - 1][0];

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
  convertClientDataToServerData(posData, userID) {
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
  setDimensions() {
    const dpr = Math.round(window.devicePixelRatio);

    this.canvas.height = this.canvas.clientHeight * dpr;
    this.canvas.width = this.canvas.clientWidth * dpr;

    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';

    this.ctx.scale(dpr, dpr);
  }

  setLineWidth(width = this.width) {
    this.ctx.lineWidth = width;
  }
  setStrokeStyle(hue = this.hue, hasReducedAlpha) {
    this.ctx.strokeStyle = makeHSLString(hue, hasReducedAlpha);
  }
}
