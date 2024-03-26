export class SocketBase {
  #eventList = {};

  constructor(socket) {
    this.socket = socket;
  }

  // ---- Event handling ----
  addEventListener(type, callback) {
    this._addEvent(type, callback);
  }
  removeEventListener(type, callback) {
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
