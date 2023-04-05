'use strict';
class ScratchetCanvas extends ScratchetCanvasControls {
  /** @type {[number, number]} */
  lastPos = new Array(2);

  hasErased = false;
  isDrawing = false;

  tools;
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
   * Contains points which were undone so that they can be redone.
   */
  redoBuffer = new Array();

  /**
   * @typedef { Object } undoEraseInfo
   * @prop { number } bufferIndex At which buffer length the info object is applied to.
   * @prop { Array<Array> } wrapper The posData points.
   * @prop { Array<Array> } target The target posWrapper for {@link undoEraseInfo.wrapper}.
   */

  /**
   * Contains information of erased points so that they can be redone.
   * - One info wrapper is exactly one undo/redo step.
   * - Every info wrapper contains multiple {@link undoEraseInfo} objects.
   * - Is used in conjunction with {@link undoEraseIndex}.
   * @type { Array<Array<undoEraseInfo>> }
   */
  undoEraseQueue = new Array();
  /**
   * {@link undoEraseQueue} at this index is the current valid eraser undo/redo step.
   */
  undoEraseIndex = 0;

  /** @param { HTMLCanvasElement } canvas */
  constructor(canvas) {
    super(canvas);

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

          this.setLastPos(posX, posY);
          controller.initializeSendBufferNormal();
          break;
        }
        case Eraser: {
          ui.toggleDrawIndicatorEraseMode();
          controller.initializeSendBufferErase();
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
      controller.sendPositionsIfMetaHasChanged();

      const [posX, posY] = this.getPosWithTransform(e.clientX, e.clientY);

      switch (this.activeTool.constructor) {
        case Brush: {
          this.ctx.beginPath();
          this.ctx.moveTo(...this.lastPos);
          this.ctx.lineTo(posX, posY);
          this.ctx.stroke();

          this.setLastPos(posX, posY);

          controller.addToSendBuffer(posX, posY);
          break;
        }
        case Eraser: {
          if (this.erasePos(posX, posY, this.getOwnUser(), true)) {
            this.redrawCanvas();
            controller.sendCompleteMetaDataNextTime();
            controller.addToSendBuffer(posX, posY);
          }
          break;
        }
      }
    }
  }

  finalizeDraw() {
    if (this.isDrawing === true) {
      if (this.hasErased) {
        this.undoEraseIndex++;
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
    let hasDrawn = false;
    this.ctx.clearRect(0, 0, ScratchetCanvasControls.VIEW_WIDTH, ScratchetCanvasControls.VIEW_HEIGHT);

    for (const { posData, prevPosData, prevPosDataWrapper, wrapperStack } of ScratchetCanvas.iteratePosWrapper(this.posBuffer)) {
      hasDrawn = true;
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
    }

    if (hasDrawn) {
      this.ctx.stroke();

      this.setStrokeStyle();
      this.setLineWidth();
    }
  }

  drawFromPosData(posData) {
    this.ctx.moveTo(posData[META_LEN.NORMAL], posData[META_LEN.NORMAL + 1]);
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

  // ---- Pos buffer ----
  setLastPos(posX, posY) {
    this.lastPos[0] = posX;
    this.lastPos[1] = posY;
  }

  // ---- Undo/redo ----
  /** @param {ScratchetUser} user */
  undoPoint(user) {
    if (this.undoEraseIndex > 0
        && user.posCache.length - 1 === this.undoEraseQueue[this.undoEraseIndex - 1].at(-1).bufferIndex) {

      for (const info of this.undoEraseQueue[this.undoEraseIndex - 1]) {
        info.target.push(info.wrapper);
      }

      this.undoEraseIndex--;
      this.redrawCanvas();
    } else if (this.posBuffer.length > 0) {
      const posDataWrapper = user.posCache.pop();
      this.redoBuffer.push(posDataWrapper);
      this.deleteFromPosBuffer(posDataWrapper);

      this.redrawCanvas();
    }
  }
  /** @param {ScratchetUser} user */
  redoPoint(user) {
    if (this.undoEraseIndex < this.undoEraseQueue.length
        && user.posCache.length - 1 === this.undoEraseQueue[this.undoEraseIndex].at(-1).bufferIndex) {

      for (const info of this.undoEraseQueue[this.undoEraseIndex]) {
        info.target.splice(info.target.indexOf(info.wrapper), 1);
      }

      this.undoEraseIndex++;
      this.redrawCanvas();
    } else if (this.redoBuffer.length > 0) {
      const posDataWrapper = this.redoBuffer.pop();
      this.addToBuffer(posDataWrapper);
      user.posCache.push(posDataWrapper);

      this.redrawCanvas();
    }
  }

  // TODO bind this to a user
  clearRedoBuffer() {
    this.redoBuffer = new Array();
    if (this.undoEraseIndex < this.undoEraseQueue.length) {
      this.undoEraseQueue.splice(this.undoEraseIndex);
    }
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
      this.erasePos(data[i], data[i + 1], user, false, getClientMetaWidth(data));
    }
    this.redrawCanvas();
  }

  erasePos(targetPosX, targetPosY, user, saveRedo = false, eraserWidth = this.tools.eraser.width) {
    let hasChanged = false;
    let redoWrapper;
    let lastWrapper;

    for (const { posData, wrapperStack, index } of ScratchetCanvas.iteratePosWrapper(user.posCache)) {
      const posWrapper = wrapperStack.at(-2);
      let startIdx = META_LEN.NORMAL;
      let isErasing = false;

      if (posWrapper !== lastWrapper) {
        redoWrapper = [];
      }

      // j is used as the endIndex
      for (let j = META_LEN.NORMAL; j < posData.length; j += 2) {
        if (posIsInEraseRange(posData[j], posData[j + 1], posData[1])) {
          if (!isErasing) {
            if (startIdx !== j) {
              const newPosData = createNewPosData(posData, startIdx, j);
              posWrapper.push(newPosData);
            }
            // This needs to be at this level to accomodate for the cleanup
            hasChanged = true;
            isErasing = true;
            startIdx = j;
          }
        } else if (isErasing) {
          if (startIdx !== j) {
            const start = (startIdx > META_LEN.NORMAL) ? startIdx - 2 : startIdx;
            const eraseData = createNewPosData(posData, start, j + 2);
            redoWrapper.push(eraseData);
          }
          isErasing = false;
          startIdx = j;
        }

        // The last section needs to be handled manually.
        // This is the same procedure as in the loop above
        if (startIdx > META_LEN.NORMAL) {
          if (isErasing) {
            const eraseData = createNewPosData(posData, startIdx - 2);
            redoWrapper.push(eraseData);
          } else {
            const newPosData = createNewPosData(posData, startIdx);
            posWrapper[index] = newPosData;
          }
        }
      }

      // Remove the initial posData if the last vector in it has been erased
      if (isErasing) {
        posWrapper.splice(index, 1);
        hasChanged = true;
      }

      if (hasChanged && redoWrapper.length > 0) {
        this.addToUndoEraseQueue(user, redoWrapper, posWrapper);
      }

      lastWrapper = posWrapper;
    }

    if (hasChanged) {
      this.hasErased = true;
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
        for (let i = 0; i < newPosData.length - META_LEN.NORMAL; i++) {
          newPosData[i + META_LEN.NORMAL] = originalPosData[startIdx + i];
        }
        return newPosData;
      }
    }
  }

  addToUndoEraseQueue(user, eraseWrapper, targetWrapper) {
    let infoWrapper;
    if (this.undoEraseQueue.length === this.undoEraseIndex + 1) {
      infoWrapper = this.undoEraseQueue.at(-1);
    } else {
      infoWrapper = []
      this.undoEraseQueue.push(infoWrapper);
    }

    const lastInfo = infoWrapper.at(-1);
    if (lastInfo?.target === targetWrapper) {
      lastInfo.wrapper.push(...eraseWrapper);
    } else {
      infoWrapper.push({
        bufferIndex: user.posCache.length - 1,
        wrapper: eraseWrapper,
        target: targetWrapper
      });
    }
  }

  sendJoinedUserBuffer() {
    const userCache = this.getOwnUser().posCache;
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
      this.addToBuffer(posDataWrapper, wrapperDestIndex, insertIndex);
    } else {
      this.addToBuffer(posDataWrapper);
    }
    this.clearRedoBuffer();
    user.posCache.push(posDataWrapper);
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
  static *#iteratePosWrapperGen(
    wrapperStack,
    prevPosDataWrapper,
    prevPosData,
    index = 0
  ) {
    const posData = wrapperStack.at(-1);
    if (posData.length === 0) return;

    if (Array.isArray(posData) || posData instanceof Set) {
      let i = 0;
      for (const childWrapper of posData) {
        wrapperStack.push(childWrapper);

        for (const result of this.#iteratePosWrapperGen(wrapperStack, prevPosDataWrapper, prevPosData, i)) {
          prevPosDataWrapper = result.wrapperStack[1];
          prevPosData = result.posData;
          yield result;
        }

        wrapperStack.pop();
        i++;
      }
    } else {
      yield {
        posData,
        wrapperStack,
        prevPosDataWrapper,
        prevPosData,
        index
      };
    }
  }
}
