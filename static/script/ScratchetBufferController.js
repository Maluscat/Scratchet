'use strict';
class ScratchetBufferController {
  /**
   * A buffer collecting the drawn positions
   * and sending them to the server on {@link sendPositions} call.
   * @type { Array<number> }
   */
  sendBuffer = new Array();
  /**
   * A buffer collecting the same drawn positions as {@link sendBuffer}
   * but which is added to the client pos buffer on send.
   * @type { Array<number> }
   */
  liveClientBuffer = new Array();

  willSendCompleteMetaData = true;
  /** @type { ScratchetRoom } */
  activeRoom;

  // ---- Send buffer handling ----
  addToSendBuffer(posX, posY) {
    this.liveClientBuffer.push(posX, posY);
    this.sendBuffer.push(posX, posY);
  }

  initializeSendBufferNormal(lastPosX, lastPosY) {
    const hue = this.activeRoom.hue;
    const width = this.activeRoom.width;
    let flag = 0;

    this.sendBuffer = new Array(2);

    if (!this.willSendCompleteMetaData && getClientMetaHue(this.liveClientBuffer) === hue) {
      flag |= 0b0010;
    } else {
      this.lastHue = hue;
      this.sendBuffer.push(this.lastHue);
    }
    if (!this.willSendCompleteMetaData && getClientMetaWidth(this.liveClientBuffer) === width) {
      flag |= 0b0001;
    } else {
      this.lastWidth = width;
      this.sendBuffer.push(this.lastWidth);
    }

    this.sendBuffer.push(lastPosX, lastPosY);
    this.sendBuffer[0] = this.activeRoom.roomCode;
    this.sendBuffer[1] = flag;

    this.liveClientBuffer = [hue, width, lastPosX, lastPosY, flag];
  }
  initializeSendBufferErase() {
    this.sendBuffer = [this.activeRoom.roomCode, Global.MODE.ERASE, this.activeRoom.width];
    this.liveClientBuffer = [];
  }

  // TODO this can probably be made less redundant
  resetSendBuffer() {
    if (this.getBufferMode() === Global.MODE.ERASE) {
      this.initializeSendBufferErase();
    } else {
      this.initializeSendBufferNormal(
        this.liveClientBuffer.at(-2),
        this.liveClientBuffer.at(-1),
      );
    }
  }
  // Only update width and hue
  updateSendBuffer() {
    if (this.getBufferMode() === Global.MODE.ERASE) {
      this.initializeSendBufferErase();
    } else if (this.liveClientBuffer.length > 0) {
      this.initializeSendBufferNormal(
        this.liveClientBuffer[2],
        this.liveClientBuffer[3],
      );
    }
  }

  // ---- Send handling ----
  sendPositions() {
    const mode = this.getBufferMode();

    if (mode === Global.MODE.ERASE && this.sendBuffer.length > (META_LEN.ERASE + EXTRA_META_LEN_SEND)
        || this.liveClientBuffer.length > META_LEN.NORMAL) {
      const posData = new Int16Array(this.sendBuffer);
      sock.send(posData.buffer);
      if (this.liveClientBuffer.length > 0) {
        this.activeRoom.addClientDataToBuffer(
          new Int16Array(this.liveClientBuffer), this.activeRoom.getOwnUser());
        // posBufferServer needs to be checked due to asynchronities
        // between willSendCompleteMetaData and sendPositions
        // And to ensure that it only resets on normal mode
        if (this.willSendCompleteMetaData && mode === 0) {
          this.willSendCompleteMetaData = false;
        }
      }
      this.resetSendBuffer();
    } else {
      this.updateSendBuffer();
    }
  }

  // Overrule timer if hue or stroke width has changed
  sendPositionsIfWidthHasChanged() {
    if (this.activeRoom.width !== getClientMetaWidth(this.liveClientBuffer)) {
      this.sendPositions();
    }
  }
  sendPositionsIfHueHasChanged() {
    if (this.activeRoom.hue !== getClientMetaHue(this.liveClientBuffer)) {
      this.sendPositions();
    }
  }

  sendCompleteMetaDataNextTime() {
    this.willSendCompleteMetaData = true;
  }

  // ---- Helper functions ----
  getBufferMode() {
    return getPendingServerMetaMode(this.sendBuffer);
  }
}
