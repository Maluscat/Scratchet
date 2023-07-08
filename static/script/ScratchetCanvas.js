'use strict';
class ScratchetCanvas extends ScratchetCanvasControls {
  /** @type {[number, number]} */
  lastPos = new Array(2);

  ownUser;

  hasErased = false;
  isDrawing = false;

  startUndoEraseLen;

  tools;
  /** @type { CanvasSendBuffer } */
  sendBuffer;
  /** @type { ScratchetTool } */
  activeTool;

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
    * @param { HTMLCanvasElement } canvas
    * @param { ScratchetUser } ownUser
    */
  constructor(canvas, ownUser) {
    super(canvas);

    this.ownUser = ownUser;
    this.sendBuffer = new CanvasSendBuffer(this);
    this.tools = {
      brush: new Brush(this.setLineWidth.bind(this), this.setStrokeStyle.bind(this)),
      eraser: new Eraser(),
    };

    canvas.addEventListener('pointerdown', this.canvasDown.bind(this));
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
    if (e.button === 0) {
      this.isDrawing = true;

      // Roughly equivalent to `this.activeTool instanceof ...`, but switch-able
      switch (this.activeTool.constructor) {
        case Brush: {
          const [posX, posY] = this.getPosWithTransform(e.clientX, e.clientY);

          this.ownUser.clearRedoBuffer();

          this.setLastPos(posX, posY);
          this.sendBuffer.initializeSendBufferBrush();
          break;
        }
        case Eraser: {
          ui.toggleDrawIndicatorEraseMode();
          this.sendBuffer.initializeSendBufferErase();
          break;
        }
      }
    }

    if (e.pointerType !== 'touch') {
      this.canvasDraw(e);
    }
  }

  canvasDraw(e) {
    if (controls3D.touchIsActive) return;

    this.setCurrentMousePos(e.clientX, e.clientY);
    ui.moveDrawIndicator(e.clientX, e.clientY);

    if (this.isDrawing) {
      this.sendBuffer.sendPositionsIfMetaHasChanged();

      const [posX, posY] = this.getPosWithTransform(e.clientX, e.clientY);

      switch (this.activeTool.constructor) {
        case Brush: {
          this.ctx.beginPath();
          this.ctx.moveTo(...this.lastPos);
          this.ctx.lineTo(posX, posY);
          this.ctx.stroke();

          this.setLastPos(posX, posY);

          this.sendBuffer.addToSendBuffer(posX, posY);
          break;
        }
        case Eraser: {
          this.ownUser.eraseAtPos(posX, posY, this.tools.eraser.width,
            () => {
              if (!this.hasErased) {
                this.ownUser.clearRedoBuffer();
                this.startUndoEraseLen = this.ownUser.undoEraseQueue.length;
                this.hasErased = true;
              }
            });
          if (this.hasErased) {
            this.redrawCanvas();
            this.sendBuffer.sendCompleteMetaDataNextTime();
            this.sendBuffer.addToSendBuffer(posX, posY);
          }
          break;
        }
      }
    }
  }

  finalizeOwnDraw() {
    if (this.isDrawing === true) {
      if (this.hasErased) {
        const undoEraseGroupLen = this.ownUser.undoEraseQueue.length - this.startUndoEraseLen;
        this.ownUser.undoEraseIndex += undoEraseGroupLen;
        this.hasErased = false;
      }
      ui.toggleDrawIndicatorEraseMode(true);
      this.redrawCanvas();
      this.isDrawing = false;
    }
  }

  // ---- Canvas handling ----
  /** @param {ScratchetUser} [userHighlight] */
  redrawCanvas(userHighlight) {
    // TODO skip unseen points
    let prevPosData;
    let prevPosDataWrapper;

    this.ctx.clearRect(0, 0, ScratchetCanvasControls.VIEW_WIDTH, ScratchetCanvasControls.VIEW_HEIGHT);

    for (const { posData, wrapperStack } of ScratchetCanvas.iteratePosWrapper(this.posBuffer)) {
      let isFromHighlightedUser = false;

      if (userHighlight != null) {
        isFromHighlightedUser = !userHighlight.posCache.includes(wrapperStack[1]);
      }
      if (!prevPosData
          || getClientMetaHue(posData) !== getClientMetaHue(prevPosData)
          || getClientMetaWidth(posData) !== getClientMetaWidth(prevPosData)
            /* This forces a stroke when changing from one user to another with highlight enabled */
          || userHighlight != null && (!userHighlight.posCache.includes(prevPosDataWrapper) !== isFromHighlightedUser)) {

        if (prevPosData) {
          this.ctx.stroke();
        }

        // ASSUMPTION: all posData in posDataWrapper have the same width and hue
        // because only the eraser can form multiple posData inside one wrapper
        this.setStrokeStyle(getClientMetaHue(posData), isFromHighlightedUser);
        this.setLineWidth(getClientMetaWidth(posData));

        this.ctx.beginPath();
      }

      this.drawFromPosData(posData);

      prevPosData = posData;
      if (wrapperStack[1] !== prevPosDataWrapper) {
        prevPosDataWrapper = wrapperStack[1];
      }
    }

    if (prevPosData) {
      this.ctx.stroke();

      this.setStrokeStyle();
      this.setLineWidth();
    }
  }

  drawFromPosData(posData) {
    this.ctx.moveTo(posData[META_LEN.BRUSH], posData[META_LEN.BRUSH + 1]);
    let i = META_LEN.BRUSH;
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

  // ---- Pos buffer ----
  setLastPos(posX, posY) {
    this.lastPos[0] = posX;
    this.lastPos[1] = posY;
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

  /**
   * @param { Int16Array } data
   * @param { ScratchetUser } user
   */
  handleEraseData(data, user) {
    user.clearRedoBuffer();
    for (let i = META_LEN.ERASE; i < data.length; i += 2) {
      user.eraseAtPos(data[i], data[i + 1], getClientMetaWidth(data));
    }
    this.redrawCanvas();
  }

  sendJoinedUserBuffer() {
    const userCache = this.ownUser.posCache;
    if (userCache.length > 0) {
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
    if (user.posCache.length > 0) {
      for (const posDataWrapper of user.posCache) {
        this.deleteFromPosBuffer(posDataWrapper);
      }
      user.posCache = [];
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
      this.addToPosBuffer(posDataWrapper, wrapperDestIndex, insertIndex);
    } else {
      this.addToPosBuffer(posDataWrapper);
    }
    user.clearRedoBuffer();
    user.posCache.push(posDataWrapper);
  }

  /**
   * Add a posDataWrapper to the {@link posBuffer} with an optional init index,
   * at an optional array position.
   * @param {Array<Array<number>>} value The posDataWrapper to insert.
   * @param {number} [initIndex = Infinity] The init index of the posDataWrapper.
   * @param {number} [insertIndex = Infinity] The array index to insert value at.
   */
  addToPosBuffer(value, initIndex = Infinity, insertIndex = Infinity) {
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
    for (let i = extraLen; i < META_LEN.BRUSH - 1; i++) {
      clientPosData[i] = clientPosData[i + 1];
    }

    if (extraLen > 0) {
      if (user.posCache.length === 0) {
        return false;
      }

      const lastPosData = user.posCache[user.posCache.length - 1][0];

      // Get width/hue of the last package
      if (flag & META_FLAGS.LAST_WIDTH) {
        clientPosData[0] = clientPosData[1];
        clientPosData[1] = getClientMetaWidth(lastPosData);
      }
      if (flag & META_FLAGS.LAST_HUE) {
        clientPosData[0] = getClientMetaHue(lastPosData);
      }
    }

    clientPosData[2] = flag;

    return clientPosData;
  }
  convertClientDataToServerData(posData) {
    const flag = posData[2];
    let extraLen = getExtraMetaLengthFromFlag(flag);

    const serverPosData = new Int16Array(posData.length - extraLen);
    serverPosData.set(posData.subarray(extraLen));
    // Shift items to the right
    for (let i = META_LEN.BRUSH - extraLen - 1 - 1; i >= 0; i--) {
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

  // ---- PosData helper functions ----
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


  // ---- Misc helper functions ----
  setLineWidth(width = this.tools.brush.width) {
    this.ctx.lineWidth = width;
  }
  setStrokeStyle(hue = this.tools.brush.hue, hasReducedAlpha) {
    this.ctx.strokeStyle = makeHSLString(hue, hasReducedAlpha);
  }


  // ---- Static helper functions ----
  /**
   * @typedef { Object } recursePosWrapperYield
   * @prop { Int16Array } posData
   * @prop { Array } wrapperStack
   * @prop { Array } prevPosDataWrapper
   * @prop { Int16Array } prevPosData
   * @prop { number } index
   */

  /**
   * @param { Iterable } posWrapper
   * @return { Generator<recursePosWrapperYield> }
   */
  static *iteratePosWrapper(posWrapper) {
    yield* this.#iteratePosWrapperGen([posWrapper]);
  }
  static *#iteratePosWrapperGen(wrapperStack, index = 0) {
    const posData = wrapperStack.at(-1);
    if (posData.length === 0) return;

    if (Array.isArray(posData) || posData instanceof Set) {
      let i = 0;
      for (const childWrapper of posData) {
        wrapperStack.push(childWrapper);

        yield* this.#iteratePosWrapperGen(wrapperStack, i);

        wrapperStack.pop();
        i++;
      }
    } else {
      yield { posData, wrapperStack, index };
    }
  }
}
