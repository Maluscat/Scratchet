'use strict';
class CanvasSendHandler {
  activeIntervals = new Set();

  /** @type { SendBuffer | null } */
  activeBuffer = null;
  roomCode;

  /** @type { BrushBuffer } */
  brush;
  /** @type { EraseBuffer } */
  erase;

  /** @param { ScratchetCanvas } room */
  constructor(room, roomCode) {
    this.brush = new BrushBuffer(room);
    this.erase = new EraseBuffer(room);

    this.roomCode = roomCode;

    this.sendPositions = this.sendPositions.bind(this);
  }


  // ---- Timers ----
  activateTimers() {
    this.activeIntervals.add(
      setInterval(this.sendPositions, Global.SEND_INTERVAL));
    this.activeIntervals.add(
      setInterval(this.brush.sendCompleteMetaDataNextTime, SEND_FULL_METADATA_INTERVAL));
  }
  clearTimers() {
    for (const intervalID of this.activeIntervals) {
      clearInterval(intervalID);
    }
    this.activeIntervals.clear();
  }


  // ---- Send handling ----
  sendPositions() {
    if (!this.activeBuffer || this.activeBuffer.buffer.length === 0) return;
    if (this.activeBuffer.ready) {
      const sendData = new Int16Array(this.activeBuffer.buffer.length + 1);
      sendData.set(this.activeBuffer.buffer, 1);
      sendData[0] = this.roomCode;
      sock.send(sendData.buffer);

      this.activeBuffer.update();
    } else {
      this.activeBuffer.resetMeta();
    }
  }

  sendPositionsIfMetaHasChanged() {
    if (this.activeBuffer?.didMetaChange()) {
      this.sendPositions();
    }
  }
}
