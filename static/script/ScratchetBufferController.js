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
    this.sendBuffer.push(posX, posY);
    if (this.getBufferMode() >= 0) {
      this.liveClientBuffer.push(posX, posY);
    }
  }

  initializeSendBufferNormal(lastPosX, lastPosY) {
    const hue = this.activeRoom.hue;
    const width = this.activeRoom.width;
    const flag = this.getNormalModeFlag(hue, width);

    this.sendBuffer = new Array(2);

    // TODO put these into constants
    if ((flag & 0b0010) === 0) {
      this.lastHue = hue;
      this.sendBuffer.push(this.lastHue);
    }
    if ((flag & 0b0001) === 0) {
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
  // Update the meta in place with the assumption that no data has been added yet
  updateInitializedSendBufferMeta() {
    if (this.getBufferMode() === Global.MODE.ERASE) {
      this.sendBuffer[2] = this.activeRoom.width;
    } else if (this.getBufferMode() !== this.getNormalModeFlag(this.activeRoom.hue, this.activeRoom.width)) {
      this.initializeSendBufferNormal(
        this.liveClientBuffer[2],
        this.liveClientBuffer[3],
      );
    }
  }

  // ---- Send handling ----
  sendPositions() {
    if (this.sendBuffer.length === 0) return;
    const mode = this.getBufferMode();

    if (mode === Global.MODE.ERASE
          && this.sendBuffer.length > (META_LEN.ERASE + EXTRA_META_LEN_SEND)
        || mode >= 0
          && this.liveClientBuffer.length > META_LEN.NORMAL) {
      const posData = new Int16Array(this.sendBuffer);
      sock.send(posData.buffer);

      if (mode >= 0) {
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
      this.updateInitializedSendBufferMeta();
    }
  }

  sendPositionsIfMetaHasChanged() {
    if (this.getBufferMode() === Global.MODE.ERASE
          && this.activeRoom.width !== getClientMetaWidth(this.sendBuffer, EXTRA_META_LEN_SEND)
        || (this.getBufferMode() >= 0
          && this.activeRoom.width !== getClientMetaWidth(this.liveClientBuffer)
          || this.activeRoom.hue !== getClientMetaHue(this.liveClientBuffer))) {
      this.sendPositions();
    }
  }

  sendCompleteMetaDataNextTime() {
    this.willSendCompleteMetaData = true;
  }

  // ---- Helper functions ----
  getNormalModeFlag(hue, width) {
    let flag = 0;
    if (!this.willSendCompleteMetaData && getClientMetaHue(this.liveClientBuffer) === hue) {
      flag |= 0b0010;
    }
    if (!this.willSendCompleteMetaData && getClientMetaWidth(this.liveClientBuffer) === width) {
      flag |= 0b0001;
    }
    return flag;
  }

  getBufferMode() {
    return getPendingServerMetaMode(this.sendBuffer);
  }
}
