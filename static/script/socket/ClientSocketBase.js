import { SocketBase } from './SocketBase.js';

export class ClientSocketBase extends SocketBase {
  #pingIntervalHasChanged = false;
  #pingIntervalID;
  #pingInterval;
  /**
   * Amount of time in milliseconds that is waited for a ping response.
   * If no response comes within this window, a `timeout` event will be invoked.
   */
  pingTimeout;

  #reconnectTimeoutID = null;
  #reconnectTimeoutDuration = 250;

  maxReconnectTimeoutDuration;
  minReconnectTimeoutDuration;
  socketURL;

  /**
   * Interval in milliseconds in which to send a ping.
   * Can be changed on the fly, in which case the interval becomes
   * active once the current ping has fired.
   *
   * Set to 0 to disable.
   * @default 0
   * @type { number }
   */
  get pingInterval() {
    return this.#pingInterval;
  }
  set pingInterval(val) {
    const currentVal = this.#pingInterval;
    if (val !== currentVal) {
      this.#pingIntervalHasChanged = true;
      this.#pingInterval = val;
      if (currentVal === 0) {
        this.#startPingInterval();
      }
    }
  }

  constructor(url, {
    pingInterval = 0,
    pingTimeout = 3000,
    maxReconnectTimeoutDuration = 10000,
    minReconnectTimeoutDuration = 750,
  }) {
    super(null);
    this._socketClosed = this._socketClosed.bind(this);
    this._socketConnected = this._socketConnected.bind(this);
    this.sendPing = this.sendPing.bind(this);

    this.socketURL = url;
    this.pingTimeout = pingTimeout;
    this.pingInterval = pingInterval;
    this.maxReconnectTimeoutDuration = maxReconnectTimeoutDuration;
    this.minReconnectTimeoutDuration = minReconnectTimeoutDuration;

    this.addEventListener('open', this._socketConnected);
    this.addEventListener('close', this._socketClosed);
  }

  send(message) {
    this.socket.send(message);
  }
  sendEvent(eventType, data = {}) {
    data.evt = eventType;
    this.send(JSON.stringify(data));
  }
  sendPing() {
    super.sendPing();
    if (this.#pingIntervalHasChanged) {
      this.#restartPingInterval();
    }
    this._addPingTimeout(this.pingTimeout);
  }

  _handleReceivedPing() {
    super._handleReceivedPing();
    this._clearPingTimeout();
  }

  // ---- Connection handling ----
  initializeConnection() {
    this.socket = new WebSocket(this.socketURL);
    this._addEventsAgain();
  }

  _socketClosed(e) {
    this.#trySocketReconnect();
    this.stopPingImmediately();
  }
  _socketConnected() {
    this.stopReconnectionAttempt();
    this.#startPingInterval();
    this.isTimedOut = false;
  }

  stopReconnectionAttempt() {
    this.#reconnectTimeoutDuration = this.minReconnectTimeoutDuration;
    if (this.#reconnectTimeoutID != null) {
      clearTimeout(this.#reconnectTimeoutID);
      this.#reconnectTimeoutID = null;
    }
  }
  #trySocketReconnect() {
    this.#reconnectTimeoutID = setTimeout(() => {
      this.initializeConnection();
      this.#reconnectTimeoutDuration =
        Math.min(this.maxReconnectTimeoutDuration, this.#reconnectTimeoutDuration * 2);
    }, this.#reconnectTimeoutDuration);
  }


  // ---- Helper functions ----
  stopPingImmediately() {
    if (this.#pingIntervalID != null) {
      clearTimeout(this.#pingIntervalID);
      this.#pingIntervalID = null;
    }
    this.#pingIntervalHasChanged = false;
  }
  #startPingInterval() {
    if (this.#pingInterval > 0) {
      this.#pingIntervalID = setInterval(this.sendPing, this.#pingInterval);
    }
  }

  #restartPingInterval() {
    this.stopPingImmediately();
    this.#startPingInterval();
  }
}
