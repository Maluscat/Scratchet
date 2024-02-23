'use strict';
class ScratchetCanvas {
  ownUser;

  hasErased = false;
  isDrawing = false;

  tools;
  /** @type { CanvasSendHandler } */
  sendHandler;
  /** @type { ScratchetTool } */
  activeTool;

  view;


  /**
    * @param { HTMLCanvasElement } canvas
    * @param { ScratchetUser } ownUser
    */
  constructor(canvas, ownUser, roomCode) {
    this.addOwnClientDataToBuffer = this.addOwnClientDataToBuffer.bind(this);

    this.ownUser = ownUser;

    this.sendHandler = new CanvasSendHandler(roomCode, this.addOwnClientDataToBuffer);
    this.view = new CanvasViewTransform(canvas, [ this.sendHandler.brush.liveClientBuffer ]);

    this.tools = {
      brush: new Brush(
        val => {
          this.sendHandler.brush.updateWidth(val);
        },
        val => {
          this.sendHandler.brush.updateHue(val);
        }),
      eraser: new Eraser(val => this.sendHandler.erase.updateWidth(val)),
    };

    canvas.addEventListener('pointerdown', this.canvasDown.bind(this));
    canvas.addEventListener('pointermove', this.canvasDraw.bind(this));

    this.sendHandler.brush.updateHue(this.tools.brush.hue);
    this.sendHandler.brush.updateWidth(this.tools.brush.width);
    this.sendHandler.erase.updateWidth(this.tools.eraser.width);

    this.view.setTransform();
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
          this.sendHandler.brush.reset();
          this.ownUser.startBrushGroupCapture();
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

    this.view.setCurrentMousePos(e.clientX, e.clientY);
    ui.moveDrawIndicator(e.clientX, e.clientY);

    if (this.isDrawing) {
      const [posX, posY] = this.view.getPosWithTransform(e.clientX, e.clientY);

      switch (this.activeTool.constructor) {
        case Brush: {
          this.sendHandler.addData('brush', posX, posY);
          this.view.update();
          break;
        }
        case Eraser: {
          this.ownUser.erase(posX, posY, this.tools.eraser.width,
            () => {
              if (!this.hasErased) {
                this.ownUser.startEraseGroupCapture();
                this.hasErased = true;
              }
            });
          if (this.hasErased) {
            this.view.update();
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
    this.sendHandler.brush.reset();
    if (this.isDrawing === true) {
      this.ownUser.captureUndoGroup();
      this.view.update();
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
    this.view.update();
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
    for (let i = Meta.LEN.ERASE; i < data.length; i += 2) {
      user.erase(data[i], data[i + 1], Meta.getClientWidth(data));
    }
    this.view.update();
  }

  sendJoinedUserBuffer() {
    const userCache = this.ownUser.posCache;
    if (userCache.length > 0) {
      const buffer = [];

      for (const posWrapper of userCache) {
        const wrapperDestIndex = this.view.posHandler.getPosIndex(posWrapper);

        for (const { posData } of PositionDataHandler.iteratePosWrapper(posWrapper)) {
          buffer.push(
            Global.MODE.BULK_INIT,
            wrapperDestIndex,
            ...this.convertClientDataToServerData(posData));
        }
      }
      this.sendHandler.sendData(buffer);
    }
  }

  clearUserBufferAndRedraw(user) {
    if (user.posCache.length > 0) {
      for (const posDataWrapper of user.posCache) {
        this.view.posHandler.deleteFromBuffer(posDataWrapper);
      }
      user.posCache = [];
      this.view.update();
    }
  }

  addServerDataToBuffer(posData, user, wrapperDestIndex) {
    posData = this.convertServerDataToClientData(posData, user);
    if (posData) {
      this.addClientDataToBuffer(posData, user, wrapperDestIndex);
    }
  }
  addServerDataToBufferAndDraw(posData, user) {
    user.setColorIndicator(Meta.getClientHue(posData));
    this.addServerDataToBuffer(posData, user);
    this.view.update();
  }

  addOwnClientDataToBuffer(posData) {
    this.addClientDataToBuffer(posData, this.ownUser);
    this.view.update();
  }

  addClientDataToBuffer(posData, user, wrapperDestIndex) {
    const posDataWrapper = Meta.createPosDataWrapper(posData);
    this.view.posHandler.addToBuffer(posDataWrapper, wrapperDestIndex);
    user.clearRedoBuffer();
    user.posCache.push(posDataWrapper);
  }

  // ---- Protocol converter ----
  convertServerDataToClientData(posData, user) {
    const flag = posData[0];
    const extraLen = Meta.getExtraLengthFromFlag(flag);

    const clientPosData = new Int16Array(posData.length + extraLen);
    clientPosData.set(posData, extraLen);
    // Shift items to the left
    for (let i = extraLen; i < Meta.LEN.BRUSH - 1; i++) {
      clientPosData[i] = clientPosData[i + 1];
    }

    if (extraLen > 0) {
      if (user.posCache.length === 0) {
        return false;
      }

      const lastPosData = user.posCache[user.posCache.length - 1][0];

      // Get width/hue of the last package
      if (flag & Meta.FLAGS.LAST_WIDTH) {
        clientPosData[0] = clientPosData[1];
        clientPosData[1] = Meta.getClientWidth(lastPosData);
      }
      if (flag & Meta.FLAGS.LAST_HUE) {
        clientPosData[0] = Meta.getClientHue(lastPosData);
      }
    }

    clientPosData[2] = flag;

    return clientPosData;
  }
  convertClientDataToServerData(posData) {
    const flag = posData[2];
    let extraLen = Meta.getExtraLengthFromFlag(flag);

    const serverPosData = new Int16Array(posData.length - extraLen);
    serverPosData.set(posData.subarray(extraLen));
    // Shift items to the right
    for (let i = Meta.LEN.BRUSH - extraLen - 1 - 1; i >= 0; i--) {
      serverPosData[i + 1] = serverPosData[i];
    }

    if ((flag & Meta.FLAGS.LAST_WIDTH) === 0) {
      serverPosData[extraLen--] = Meta.getClientWidth(posData);
    }
    if ((flag & Meta.FLAGS.LAST_HUE) === 0) {
      serverPosData[extraLen--] = Meta.getClientHue(posData);
    }

    serverPosData[0] = flag;

    return serverPosData;
  }
}
