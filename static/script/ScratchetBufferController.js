'use strict';
class ScratchtBufferController {
  sendBufferServer = new Array();
  sendBufferClient = new Array();

  willSendCompleteMetaData = true;
  /** @type { ScratchetRoom } */
  activeRoom;

  // ---- Send buffer handling ----
  addToSendBuffer(posX, posY) {
    this.sendBufferClient.push(posX, posY);
    this.sendBufferServer.push(posX, posY);
  }

  initializeSendBufferNormal(lastPosX, lastPosY) {
    const hue = this.activeRoom.hue;
    const width = this.activeRoom.width;
    let flag = 0;

    this.sendBufferServer = new Array(2);

    if (!this.willSendCompleteMetaData && getClientMetaHue(this.sendBufferClient) === hue) {
      flag |= 0b0010;
    } else {
      this.lastHue = hue;
      this.sendBufferServer.push(this.lastHue);
    }
    if (!this.willSendCompleteMetaData && getClientMetaWidth(this.sendBufferClient) === width) {
      flag |= 0b0001;
    } else {
      this.lastWidth = width;
      this.sendBufferServer.push(this.lastWidth);
    }

    this.sendBufferServer.push(lastPosX, lastPosY);
    this.sendBufferServer[0] = this.activeRoom.roomCode;
    this.sendBufferServer[1] = flag;

    this.sendBufferClient = [hue, width, lastPosX, lastPosY, flag];
  }
  initializeSendBufferErase() {
    this.sendBufferServer = [this.activeRoom.roomCode, Global.MODE.ERASE, this.activeRoom.width];
    this.sendBufferClient = [];
  }

  // TODO this can probably be made less redundant
  resetSendBuffer() {
    if (this.getBufferMode() === Global.MODE.ERASE) {
      this.initializeSendBufferErase();
    } else {
      this.initializeSendBufferNormal(
        this.sendBufferClient.at(-2),
        this.sendBufferClient.at(-1),
      );
    }
  }
  // Only update width and hue
  updateSendBuffer() {
    if (this.getBufferMode() === Global.MODE.ERASE) {
      this.initializeSendBufferErase();
    } else if (this.sendBufferClient.length > 0) {
      this.initializeSendBufferNormal(
        this.sendBufferClient[2],
        this.sendBufferClient[3],
      );
    }
  }

  // ---- Send handling ----
  sendPositions() {
    const mode = this.getBufferMode();

    if (mode === Global.MODE.ERASE && this.sendBufferServer.length > (META_LEN.ERASE + EXTRA_SERVER_META_LEN)
        || this.sendBufferClient.length > META_LEN.NORMAL) {
      const posData = new Int16Array(this.sendBufferServer);
      sock.send(posData.buffer);
      if (this.sendBufferClient.length > 0) {
        this.activeRoom.addClientDataToBuffer(
          new Int16Array(this.sendBufferClient), this.activeRoom.getOwnUser());
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
    if (this.activeRoom.width !== getClientMetaWidth(this.sendBufferClient)) {
      this.sendPositions();
    }
  }
  sendPositionsIfHueHasChanged() {
    if (this.activeRoom.hue !== getClientMetaHue(this.sendBufferClient)) {
      this.sendPositions();
    }
  }

  sendCompleteMetaDataNextTime() {
    this.willSendCompleteMetaData = true;
  }

  // ---- Helper functions ----
  getBufferMode() {
    return getPendingServerMetaMode(this.sendBufferServer);
  }
}
