export class SocketBase {
  static pingPayload = Uint8Array.of(0).buffer;

  /** @type { number | null } */
  #awaitPingTimeoutID = null;
  #eventList = {};

  isTimedOut;
  socket;

  constructor(socket) {
    this.socket = socket;

    this._messageIntercept = this._messageIntercept.bind(this);
    this._missedPing = this._missedPing.bind(this);
  }

  // ---- Ping handling ----
  /** @param { MessageEvent } e */
  async _messageIntercept(e, ...args) {
    // The frontend receives data as a Blob, the backend as an ArrayBuffer.
    if (e.data instanceof Blob || e.data instanceof ArrayBuffer) {
      let pingDataArr;
      if (e.data instanceof Blob && e.data.size === 1) {
        pingDataArr = new Uint8Array(await e.data.arrayBuffer());
      } else if (e.data instanceof ArrayBuffer && e.data.byteLength === 1) {
        pingDataArr = new Uint8Array(e.data);
      }
      if (pingDataArr && pingDataArr[0] === 0) {
        this._handleReceivedPing();
        return;
      }
    }
    this.invokeEvent('_originalMessage', e, ...args);
  }

  _missedPing() {
    this.invokeEvent('_timeout');
    this.isTimedOut = true;
  }

  _handleReceivedPing() {
    if (this.isTimedOut) {
      this.isTimedOut = false;
      this.invokeEvent('_reconnect');
    }
  }

  _addPingTimeout(duration) {
    this._clearPingTimeout();
    this.#awaitPingTimeoutID = setTimeout(this._missedPing, duration);
  }
  _clearPingTimeout() {
    if (this.#awaitPingTimeoutID != null) {
      clearTimeout(this.#awaitPingTimeoutID);
    }
  }

  sendPing() {
    this.socket.send(SocketBase.pingPayload);
  }


  // ---- Event handling ----
  addEventListener(type, callback) {
    if (type === 'message') {
      this._addEvent('_originalMessage', callback);
      callback = this._messageIntercept;
    }
    this._addEvent(type, callback);
  }
  removeEventListener(type, callback) {
    if (type === 'message') {
      this._removeEvent('_originalMessage', callback);
      callback = this._messageIntercept;
    }
    this._removeEvent(type, callback);
  }

  _addEvent(type, callback) {
    if (!type.startsWith('_')) {
      this.socket.addEventListener(...arguments);
    } else {
      if (!(type in this.#eventList)) {
        this.#eventList[type] = [];
      }
      this.#eventList[type].push(callback);
    }
  }
  _removeEvent(type, callback) {
    if (!type.startsWith('_')) {
      this.socket.removeEventListener(...arguments);
    } else {
      const callbacks = this.#eventList[type];
      callbacks?.splice(callbacks.indexOf(callback), 1);
    }
  }

  invokeEvent(type, ...args) {
    this.#eventList[type]?.forEach(callback => {
      callback(...args);
    });
  }
}
