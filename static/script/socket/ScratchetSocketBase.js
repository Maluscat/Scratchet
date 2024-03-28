import { ClientSocketBase } from './ClientSocketBase.js';
import { controller, ui } from '~/init.js';

export class ScratchetSocketBase extends ClientSocketBase {
  #notificationIntervalID = null;


  constructor() {
    super(...arguments);
    this.socketReconnect = this.socketReconnect.bind(this);
    this.socketTimeout = this.socketTimeout.bind(this);

    this.addEventListener('_timeout', this.socketTimeout);
    this.addEventListener('_reconnect', this.socketReconnect);
  }

  // ---- Shims ----
  /** @param { CloseEvent } e */
  _socketClosed(e) {
    super._socketClosed(e);
    if (!e.wasClean) {
      ui.dispatchNotification('⚡ Server closed the connection unexpectedly ⚡', 'closed');
    } else {
      ui.dispatchNotification('⚡ The connection was closed ⚡', 'closed');
    }
  }

  _socketConnected() {
    super._socketConnected();
    ui.clearNotification('closed');
    ui.clearNotification('errored');
    ui.dispatchNotification('🔗 Connected 🔗');
  }

  stopReconnectionAttempt() {
    super.stopReconnectionAttempt();
  }

  // ---- Scratchet methods ----
  socketTimeout() {
    if (!this.isTimedOut) {
      ui.dispatchNotification('⚡ Connection lost ⚡', 'timeout');
    }
  }
  socketReconnect() {
    ui.clearNotification('timeout');
    ui.dispatchNotification('🔗 Reconnected 🔗');
  }
}
