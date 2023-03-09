'use strict';
const notificationTemplate = (function() {
  const node = document.createElement('div');
  node.classList.add('notification');
  node.classList.add('button');
  return node;
}());

const notificationWrapper = document.getElementById('notification-overlay');
const drawIndicator = document.getElementById('draw-indicator');
const hitBorder = document.getElementById('hit-border');

const toolButtons = document.querySelectorAll('#toolbar > .button');

const newRoomButton = document.getElementById('new-room-button');
const leaveRoomButton = document.getElementById('leave-room-button');
const joinRoomButton = document.getElementById('join-room-button');
const copyRoomLinkButton = document.getElementById('copy-room-link-button');

const nonPersistentButtons = Array.from(document.querySelectorAll('button:not(.persistent)'));

const overlayInputInvalidTimeouts = new Map();
const hitBorderTimeouts = {
  left: null,
  top: null,
  right: null,
  bottom: null
};

class UIHandler {
  #prefersReducedMotionQuery;

  get prefersReducedMotion() {
    return this.#prefersReducedMotionQuery.matches;
  }

  constructor() {
    this.#prefersReducedMotionQuery = window.matchMedia('(prefers-reduced-motion)');

    joinRoomOverlayInput.addEventListener('keydown', this.handleJoinRoomInputKeys.bind(this));
    joinRoomOverlayInput.addEventListener('paste', this.handleJoinRoomInputPaste.bind(this));

    userListButton.addEventListener('click', this.toggleHoverOverlay.bind(this));
    roomListButton.addEventListener('click', this.toggleHoverOverlay.bind(this));
    joinRoomButton.addEventListener('click', this.focusJoinRoomOverlay.bind(this));
  }

  // ---- Misc events ----
  toggleHoverOverlay(e) {
    e.currentTarget.parentNode.querySelector('.hover-overlay').classList.toggle('active');
  }

  // ---- Input helpers ----
  registerInputHandler(inputElement, submitCallback, validatorMaxLen, validatorCallback) {
    inputElement.addEventListener('keydown', this.handleOverlayInputKeys.bind(this));
    inputElement.addEventListener('beforeinput', e => {
      this.handleOverlayInputBeforeChange(e, validatorMaxLen);
    });
    inputElement.addEventListener('input', e => {
      this.handleOverlayInputChange(e, validatorCallback);
    });
    inputElement.addEventListener('blur', e => {
      this.handleOverlayInputSubmit(e, submitCallback);
    });
  }

  // ---- Input events ----
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

  // Prevent editing when content exceeds maximum length
  handleOverlayInputBeforeChange(e, maxLength) {
    // Needs to be saved because `e.currentTarget` is short lived (-> timeout below)
    const targetNode = e.currentTarget;
    const addedContentLen = (e.data || e.dataTransfer?.getData('text/plain'))?.length ?? 0;
    let addedTotalLen = 0;
    // Compute the length of the new content, taking all ranges (i.e. text selections) into account
    for (const range of e.getTargetRanges()) {
      addedTotalLen += addedContentLen - (range.endOffset - range.startOffset);
    }
    const newContentLength = targetNode.textContent.length + addedTotalLen;
    if (newContentLength > maxLength) {
      e.preventDefault();
      invalidBlink();
    }

    function invalidBlink() {
      targetNode.classList.add('invalid');
      if (overlayInputInvalidTimeouts.has(targetNode)) {
        clearTimeout(overlayInputInvalidTimeouts.get(targetNode));
      }
      overlayInputInvalidTimeouts.set(targetNode,
        setTimeout(() => {
          targetNode.classList.remove('invalid');
        }, OVERLAY_INPUT_INVALID_DURATION)
      );
    }
  }
  handleOverlayInputChange(e, validatorCallback) {
    const content = e.currentTarget.textContent;
    if (content !== '' && !validatorCallback(content)) {
      e.currentTarget.classList.add('invalid');
    } else {
      e.currentTarget.classList.remove('invalid');
    }
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
    const value = e.clipboardData.getData('text/plain');
    // submitJoinRoomInput happens before the paste is applied to the input
    if (this.submitJoinRoomInput(value)) {
      e.preventDefault();
    }
  }

  submitJoinRoomInput(value = joinRoomOverlayInput.value) {
    joinRoomOverlayInput.value = '';
    return controller.joinRoom(value);
  }

  // ---- General focus handling ----
  activateUI() {
    document.body.classList.remove('inactive');
    this.updateNonPersistentTabIndex(0);
  }
  deactivateUI() {
    document.body.classList.add('inactive');
    this.updateNonPersistentTabIndex(-1);

    if (nonPersistentButtons.includes(document.activeElement)) {
      document.activeElement.blur();
    }
  }

  updateNonPersistentTabIndex(value) {
    for (const button of nonPersistentButtons) {
      button.tabIndex = value;
    }
  }

  // ---- Animation helpers ----
  blockCanvasInOutAnimation() {
    canvasContainer.classList.add('block-inout-animation');
    setTimeout(() => {
      canvasContainer.classList.remove('block-inout-animation');
    }, getCanvasAnimDurationInOut());
  }

  // ---- Indicators ----
  setRoomIndicator(value) {
    roomListButton.textContent = value;
  }
  setUserIndicator(value) {
    userListButton.textContent = value;
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
