'use strict';
class CanvasSendHandler {
  activeIntervals = new Set();

  /** @type { SendBuffer | null } */
  activeBuffer = null;
  roomCode;

  buffers = {};

  /** @type { BrushBuffer } */
  get brush() {
    return this.buffers.brush;
  }
  /** @type { EraseBuffer } */
  get erase() {
    return this.buffers.erase;
  }

  constructor(roomCode, sendClientFn) {
    this.roomCode = roomCode;

    this.send = this.send.bind(this);

    this.buffers.brush = new BrushBuffer(sendClientFn, this.send);
    this.buffers.erase = new EraseBuffer(this.send);
  }


  // ---- Timers ----
  activateTimers() {
    this.activeIntervals.add(
      setInterval(this.send, Global.SEND_INTERVAL));
    this.activeIntervals.add(
      setInterval(this.brush.sendCompleteMetaDataNextTime, SEND_FULL_METADATA_INTERVAL));
  }
  clearTimers() {
    for (const intervalID of this.activeIntervals) {
      clearInterval(intervalID);
    }
    this.activeIntervals.clear();
  }


  // ---- Adding data ----
  addData(bufferName, ...data) {
    const buffer = this.buffers[bufferName];
    if (this.activeBuffer === buffer) {
      this.activeBuffer.add(...data);
    } else {
      this.send();

      this.activeBuffer = buffer;
      this.activeBuffer.reset();
      this.activeBuffer.add(...data);
    }
  }


  // ---- Send handling ----
  send() {
    if (this.activeBuffer?.ready) {
      sock.send(this.#getSendData());
      this.activeBuffer.update();
      return true;
    }
    return false;
  }

  #getSendData() {
    const sendData = new Int16Array(this.activeBuffer.buffer.length + 1);
    sendData.set(this.activeBuffer.buffer, 1);
    sendData[0] = this.roomCode;
    return sendData.buffer;
  }
}
