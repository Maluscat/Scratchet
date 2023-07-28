'use strict';
class ScratchetCanvas extends CanvasViewTransform {
  /** @type {[number, number]} */
  lastPos = new Array(2);

  ownUser;

  hasErased = false;
  isDrawing = false;

  tools;
  /** @type { CanvasSendHandler } */
  sendHandler;
  /** @type { ScratchetTool } */
  activeTool;

  /** @type { CanvasView } */
  view;


  /**
    * @param { HTMLCanvasElement } canvas
    * @param { OwnUser } ownUser
    */
  constructor(canvas, ownUser, roomCode) {
    super(canvas);
    this.ownUser = ownUser;

    this.addOwnClientDataToBuffer = this.addOwnClientDataToBuffer.bind(this);

    this.sendHandler = new CanvasSendHandler(roomCode, this.addOwnClientDataToBuffer);
    this.view = new CanvasView(canvas);

    this.tools = {
      brush: new Brush(
        val => {
          this.view.setLineWidth(val);
          this.sendHandler.brush.updateWidth(val);
        },
        val => {
          this.view.setStrokeStyle(val);
          this.sendHandler.brush.updateHue(val);
        }),
      eraser: new Eraser(val => this.sendHandler.erase.updateWidth(val)),
    };

    canvas.addEventListener('pointerdown', this.canvasDown.bind(this));
    canvas.addEventListener('pointermove', this.canvasDraw.bind(this));

    this.sendHandler.brush.updateHue(this.tools.brush.hue);
    this.sendHandler.brush.updateWidth(this.tools.brush.width);
    this.sendHandler.erase.updateWidth(this.tools.eraser.width);

    this.view.setLineWidth(this.tools.brush.width);
    this.view.setStrokeStyle(this.tools.brush.hue);

    this.setTransform();
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
      // This is potentially not necessary – It's a safety measure.
      this.ownUser.clearUndoGroupCaptureData();

      // Roughly equivalent to `this.activeTool instanceof ...`, but switch-able
      switch (this.activeTool.constructor) {
        case Brush: {
          const [posX, posY] = this.getPosWithTransform(e.clientX, e.clientY);

          this.ownUser.startBrushGroupCapture();

          this.setLastPos(posX, posY);
          this.sendHandler.brush.reset();
          break;
        }
        case Eraser: {
          ui.toggleDrawIndicatorEraseMode();
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
      const [posX, posY] = this.getPosWithTransform(e.clientX, e.clientY);

      switch (this.activeTool.constructor) {
        case Brush: {
          this.ctx.beginPath();
          this.ctx.moveTo(...this.lastPos);
          this.ctx.lineTo(posX, posY);
          this.ctx.stroke();

          this.setLastPos(posX, posY);

          this.sendHandler.addData('brush', posX, posY);
          break;
        }
        case Eraser: {
          this.ownUser.eraseAtPos(posX, posY, this.tools.eraser.width,
            () => {
              if (!this.hasErased) {
                this.ownUser.startEraseGroupCapture();
                this.hasErased = true;
              }
            });
          if (this.hasErased) {
            this.redraw();
            this.sendHandler.brush.sendCompleteMetaDataNextTime();
            this.sendHandler.addData('erase', posX, posY);
          }
          break;
        }
      }
    }
  }

  finalizeOwnDraw() {
    this.sendHandler.send();
    if (this.isDrawing === true) {
      this.ownUser.captureUndoGroup();
      this.redraw();
      this.isDrawing = false;
      this.hasErased = false;
      ui.toggleDrawIndicatorEraseMode(true);
    }
  }

  // ---- User handling ----
  ownUndo() {
    const count = this.ownUser.undo(this);
    if (count > 0) {
      this.sendHandler.addData('undo', count);
    }
  }
  ownRedo() {
    const count = this.ownUser.redo(this);
    if (count > 0) {
      this.sendHandler.addData('redo', count);
    }
  }

  /**
   * @param { Int16Array } data
   * @param { ScratchetUser } user
   */
  undo(data, user) {
    const count = data[1];
    user.undo(this, count);
  }
  /**
   * @param { Int16Array } data
   * @param { ScratchetUser } user
   */
  redo(data, user) {
    const count = data[1];
    user.redo(this, count);
  }

  redraw(userHighlight) {
    this.view.redraw(this.posBuffer, userHighlight);
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
    this.redraw();
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
    this.redraw();
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
      this.redraw();
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
    this.redraw();
  }

  addOwnClientDataToBuffer(posData) {
    this.addClientDataToBuffer(posData, this.ownUser);
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
