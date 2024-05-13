import { ClientSocketBase } from '@lib/socket-handler/script/ClientSocketBase.js';
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
    this.#startNotificationLoop();
  }

  _socketConnected() {
    super._socketConnected();
    ui.clearNotification('closed');
    ui.clearNotification('errored');
    ui.dispatchNotification('🔗 Connected 🔗');
  }

  stopReconnectionAttempt() {
    super.stopReconnectionAttempt();
    this.#clearNotificationLoop();
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


  // ---- Helper functions ----
  #startNotificationLoop() {
    if (this.#notificationIntervalID == null) {
      const notif = ui.dispatchNotification('Trying to reconnect...', 'try-reconnect');
      let dots = 0;
      this.#notificationIntervalID = setInterval(() => {
        dots = (++dots % 4);
        notif.textContent = 'Trying to reconnect' + '.'.repeat(dots);
      }, 1000);
    }
  }
  #clearNotificationLoop() {
    ui.clearNotification('try-reconnect');
    if (this.#notificationIntervalID != null) {
      clearTimeout(this.#notificationIntervalID);
      this.#notificationIntervalID = null;
    }
  }
}
