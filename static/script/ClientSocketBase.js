class ClientSocketBase extends WebSocket {
  sendEvent(eventType, data = {}) {
    data.evt = eventType;
    this.send(JSON.stringify(data));
  }
  send(message) {
    super.send(message);
  }

  addEventListener(type, callback) {
    super.addEventListener(...arguments);
  }
}
