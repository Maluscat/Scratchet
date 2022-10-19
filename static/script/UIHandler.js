'use strict';

const notificationWrapper = document.getElementById('notification-overlay');
const drawIndicator = document.getElementById('draw-indicator');
const hitBorder = document.getElementById('hit-border');

const hitBorderTimeouts = {
  left: null,
  top: null,
  right: null,
  bottom: null
};

class UIHandler {
  constructor() {
    usernameInput.addEventListener('blur', e => {
      this.handleOverlayInputSubmit(e, controller.changeOwnUsername.bind(controller));
    });
    roomNameInput.addEventListener('blur', e => {
      this.handleOverlayInputSubmit(e, controller.changeCurrentRoomName.bind(controller));
    });
    for (const l of document.querySelectorAll('.overlay-input')) {
      l.addEventListener('keydown', this.handleOverlayInputKeys.bind(this));
    }

    joinRoomOverlayInput.addEventListener('keydown', this.handleJoinRoomInputKeys.bind(this));
    joinRoomOverlayInput.addEventListener('paste', this.handleJoinRoomInputPaste.bind(this));

    userListButton.addEventListener('click', this.toggleHoverOverlay.bind(this));
    roomListButton.addEventListener('click', this.toggleHoverOverlay.bind(this));
    joinRoomButton.addEventListener('click', this.focusJoinRoomOverlay.bind(this));
    copyRoomLinkButton.addEventListener('click', controller.copyRoomLink.bind(controller));

    window.addEventListener('wheel', this.mouseWheel.bind(this), { passive: false });
    window.addEventListener('resize', controller.windowResized.bind(controller));
  }

  // ---- Misc events ----
  mouseWheel(e) {
    if (e.deltaY !== 0) {
      const direction = -1 * (e.deltaY / Math.abs(e.deltaY)); // either 1 or -1
      if (e.shiftKey) {
        widthSlider.value += direction * 7;
      } else if (e.ctrlKey) {
        e.preventDefault();
        hueSlider.value += direction * 24;
      }
    }
  }

  // ---- Overlay events ----
  handleOverlayInputKeys(e) {
    if (e.key === 'Enter' || e.key === 'Escape') {
      e.currentTarget.blur();
    }
  }
  handleOverlayInputSubmit(e, callback) {
    // From https://stackoverflow.com/a/30520997
    for (const brNode of e.currentTarget.getElementsByTagName('br')) {
      brNode.remove();
    }
    window.getSelection().removeAllRanges();
    callback(e.currentTarget.textContent);
  }

  toggleHoverOverlay(e) {
    e.currentTarget.parentNode.querySelector('.hover-overlay').classList.toggle('active');
  }

  // ---- Join room input events ----
  focusJoinRoomOverlay() {
    joinRoomOverlayInput.classList.toggle('active');
    joinRoomOverlayInput.focus();
  }
  collapseJoinRoomOverlay() {
    joinRoomOverlayInput.blur();
    joinRoomOverlayInput.classList.remove('active');
  }
  handleJoinRoomInputKeys(e) {
    if (e.key === 'Escape' || e.key === 'Enter' && joinRoomOverlayInput.value === '') {
      this.collapseJoinRoomOverlay();
    }
    if (e.key === 'Enter') {
      this.submitJoinRoomInput();
    }
  }
  handleJoinRoomInputPaste(e) {
    const value = (e.clipboardData || window.clipboardData).getData('text');
    // submitJoinRoomInput happens before the paste is applied to the input
    if (this.submitJoinRoomInput(value)) {
      e.preventDefault();
    }
  }

  submitJoinRoomInput(value = joinRoomOverlayInput.value) {
    joinRoomOverlayInput.value = '';
    return controller.joinRoom(value);
  }

  // ---- Draw indicator ----
  toggleDrawIndicatorEraseMode(reset) {
    if (reset) {
      drawIndicator.classList.remove('erase');
    } else {
      drawIndicator.classList.add('erase');
    }
  }
  moveDrawIndicator(posX, posY) {
    document.documentElement.style.setProperty('--mouseX', posX + 'px');
    document.documentElement.style.setProperty('--mouseY', posY + 'px');
  }
  resizeDrawIndicator(scale) {
    document.documentElement.style.setProperty('--scale', scale);
  }

  // ---- Transformation hit border ----
  invokeHitBorder(direction) {
    if (hitBorderTimeouts[direction] != null) {
      clearTimeout(hitBorderTimeouts[direction]);
    } else {
      hitBorder.classList.add('hit-' + direction);
    }

    hitBorderTimeouts[direction] = setTimeout(function() {
      hitBorder.classList.remove('hit-' + direction);
      hitBorderTimeouts[direction] = null;
    }, HIT_BORDER_DURATION);
  }

  // ---- Notifications ----
  dispatchNotification(content) {
    const notification = notificationTemplate.cloneNode(true);
    notification.textContent = content;
    notificationWrapper.appendChild(notification);
    setTimeout(() => {
      notification.classList.add('remove');
      setTimeout(() => {
        notification.remove();
      }, 200);
    }, 1600);
  }
}
