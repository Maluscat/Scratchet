class ScratchetCanvas {
  canvas;
  ctx;

  pressedMouseBtn = -1;
  globalPosBuffer = new Set(); // Set<posDataWrapperInDrawOrder>
  posUserCache = new Map(); // Map<userID, Set<posDataWrapperForUser>>
  lastPos = new Array(2);

  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');

    canvas.addEventListener('contextmenu', this.canvasContext.bind(this));
    canvas.addEventListener('pointerdown', this.canvasDown.bind(this));
    window.addEventListener('pointerup', this.pointerUp.bind(this));
    canvas.addEventListener('mousemove', this.canvasDraw.bind(this));

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
    }
    this.setLastPos(e.clientX, e.clientY);
    controller.initializePosBuffer(this.pressedMouseBtn === 2, ...this.lastPos);
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
        this.erasePos(e.clientX, e.clientY, CURRENT_USER_ID);
        this.redrawCanvas();
      } else {
        controller.sendPositionsIfHueHasChanged();

        this.ctx.beginPath();
        this.ctx.moveTo(...this.lastPos);
        this.ctx.lineTo(e.clientX, e.clientY);
        this.ctx.stroke();

        this.setLastPos(e.clientX, e.clientY);
      }
      controller.addToPosBuffer(e.clientX, e.clientY);
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
        this.setStrokeStyle(getMetaHue(posDataWrapper[0]), hasReducedAlpha);
        this.setLineWidth(getMetaWidth(posDataWrapper[0]));

        this.ctx.beginPath();
        hasChanged = false;
      }

      this.drawFromPosDataWrapper(posDataWrapper);

      if (!nextWrapper
          || getMetaHue(nextWrapper[0]) !== getMetaHue(posDataWrapper[0])
          || getMetaWidth(nextWrapper[0]) !== getMetaWidth(posDataWrapper[0])) {
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
      for (var i = META_LEN.NORMAL; i < posData.length; i += 2) {
        this.ctx.lineTo(posData[i], posData[i + 1]);
      }
    }
  }

  clearCurrentUserCanvas() {
    sendMessage('clearUser');
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
        this.addPosDataToBuffer(data.subarray(index, i), userID);
        index = i + 1;
      }
    }
    this.addPosDataToBuffer(data.subarray(index), userID);
    this.redrawCanvas();
  }
  handleEraseData(data, userID) {
    if (this.posUserCache.has(userID)) {
      const userPosSet = this.posUserCache.get(userID);
      for (let i = META_LEN.ERASE; i < data.length; i += 2) {
        this.erasePos(data[i], data[i + 1], userID, userPosSet, getMetaWidth(data));
      }
      this.redrawCanvas();
    }
  }
  erasePos(posX, posY, userID, userPosSet, eraserWidth = widthSlider.value) {
    if (!userPosSet) {
      if (!this.posUserCache.has(userID)) return;
      userPosSet = this.posUserCache.get(userID);
    }
    for (const posDataWrapper of userPosSet) {

      for (let i = 0; i < posDataWrapper.length; i++) {
        const posData = posDataWrapper[i];

        let newPosData = [posData[0], posData[1], posData[2], posData[3]];
        for (let j = META_LEN.NORMAL; j < posData.length; j += 2) {
          // Push only the points back into the array which are not in range of the erase pos
          if (Math.abs(posData[j] - posX) > eraserWidth || Math.abs(posData[j + 1] - posY) > eraserWidth) {
            newPosData.push(posData[j], posData[j + 1]);
          } else {
            if (newPosData.length > META_LEN.NORMAL) {
              posDataWrapper.push(new Int32Array(newPosData));
            }
            if (j <= posData.length - META_LEN.NORMAL) {
              newPosData = [posData[0], posData[1], posData[j + 2], posData[j + 3]];
            } else {
              newPosData = [];
            }
          }
        }

        if (newPosData.length > META_LEN.NORMAL) {
          posDataWrapper[i] = new Int32Array(newPosData);
        } else {
          posDataWrapper.splice(i, 1);
        }
      }
      if (posDataWrapper.length === 0) {
        this.globalPosBuffer.delete(posDataWrapper);
        this.posUserCache.get(userID).delete(posDataWrapper);
      }
    }
  }

  addPosDataToBuffer(posData, userID) {
    const posDataWrapper = createPosDataWrapper(posData);
    this.globalPosBuffer.add(posDataWrapper);
    let cache = this.posUserCache.get(userID);
    if (!cache) {
      cache = new Set();
      this.posUserCache.set(userID, cache);
    }
    cache.add(posDataWrapper);
  }

  sendJoinedUserBuffer(targetUserID) {
    if (this.posUserCache.has(CURRENT_USER_ID)) {
      const joinedBuffer = new Array();
      for (const posDataWrapper of this.posUserCache.get(CURRENT_USER_ID)) {
        for (const posData of posDataWrapper) {
          joinedBuffer.push(MODE.BULK_INIT, ...posData);
        }
      }
      sock.send(new Int32Array(joinedBuffer));
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

  // ---- Helper functions ----
  setDimensions() {
    canvas.height = canvas.clientHeight;
    canvas.width = canvas.clientWidth;

    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
  }

  setLineWidth(width = widthSlider.value) {
    this.ctx.lineWidth = width;
    if (width === widthSlider.value) {
      document.documentElement.style.setProperty('--strokeWidth', width + 'px');
    }
  }
  setStrokeStyle(hue = hueSlider.value, hasReducedAlpha) {
    this.ctx.strokeStyle = makeHSLString(hue, hasReducedAlpha);
  }
}
