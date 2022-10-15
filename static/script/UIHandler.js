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
