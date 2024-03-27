import { CanvasViewTransform } from '~/view/CanvasViewTransform.js';
import { UIActions } from '~/ui/UIActions.js';
import { controller } from '~/init.js';
import {
  HIT_BORDER_DURATION,
  OVERLAY_INPUT_INVALID_DURATION,
  userListButton,
  roomListButton,
  canvasContainer,
  joinRoomOverlayInput,
} from '~/constants/misc.js';

const CANVAS_ANIM_DURATION = /** @type const */ ({
  REMOVE: 260,
  INOUT: 600
});

const notificationTemplate = (function() {
  const node = document.createElement('div');
  node.classList.add('notification');
  node.classList.add('button');
  return node;
}());

const promptNode = (function() {
  const promptWrapper = document.getElementById('prompt-wrapper');
  return {
    wrapper: promptWrapper,
    header: promptWrapper.querySelector('.header'),
    cancelButton: promptWrapper.querySelector('button.cancel'),
    submitButton: promptWrapper.querySelector('button.submit')
  }
}());

const infoOverlay = document.getElementById('info-overlay');
const notificationWrapper = document.getElementById('notification-overlay');
const drawIndicator = document.getElementById('draw-indicator');
const hitBorder = document.getElementById('hit-border');

const nonPersistentButtons = Array.from(document.querySelectorAll('button:not(.persistent)'));

const overlayInputInvalidTimeouts = new Map();
const hitBorderTimeouts = {
  left: null,
  top: null,
  right: null,
  bottom: null
};


export class UIHandler {
  #prefersReducedMotionQuery;
  #stickyNotifications = {};

  scaleSlider;
  actions;

  get prefersReducedMotion() {
    return this.#prefersReducedMotionQuery.matches;
  }

  constructor() {
    this.#prefersReducedMotionQuery = window.matchMedia('(prefers-reduced-motion)');

    this.actions = new UIActions({
      leaveRoom: controller.leaveCurrentRoom,
      copyRoomLink: controller.copyRoomLink,
      createRoom: controller.requestNewRoom,
      joinRoom: this.focusJoinRoomOverlay,
      clear: controller.clearDrawing,
      undo: controller.invokeUndo,
      redo: controller.invokeRedo,
      _tools: controller.toolButtonClick
    });

    this.scaleSlider = new Slider89(infoOverlay, {
      range: [ 0, CanvasViewTransform.MAX_SCALE ],
      _percent: '100%',
      events: {
        // TODO change this to the 'update' event once it is shipped in Slider89
        'move': [(slider) => {
          controller.scaleCanvasAtCenter(slider.value);
        }],
        'change:value': [(slider) => {
          slider._percent =
            Math.round(CanvasViewTransform.scaleInterpolateFn(slider.value) * 100) + '%';
        }]
      },
      structure: `
        <indicatorWrapper>
          <:indicatorButton button "$_percent"
              type=[button] title=[Reset zoom] class=[button scale-button]>
        </indicatorWrapper>
        <:track>
      `
    });
    this.scaleSlider.node.slider.id = 'scale-slider';
    this.scaleSlider.node.indicatorButton
      .addEventListener('click', controller.scaleCanvasAtCenter.bind(controller, 0));

    userListButton.addEventListener('click', this.toggleHoverOverlay.bind(this));
    roomListButton.addEventListener('click', this.toggleHoverOverlay.bind(this));

    joinRoomOverlayInput.addEventListener('keydown', this.handleJoinRoomInputKeys.bind(this));
    joinRoomOverlayInput.addEventListener('paste', this.handleJoinRoomInputPaste.bind(this));

    promptNode.cancelButton.addEventListener('click', this.removePrompt.bind(this));
    promptNode.wrapper.addEventListener('contextmenu', this.preventPromptContext.bind(this));
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
    return controller.joinRoomFromInput(value);
  }

  // ---- General focus handling ----
  activateUI() {
    document.body.classList.remove('inactive');
    this.updateNonPersistentTabIndex(0);
    this.actions.utilityWheel.enable();
  }
  deactivateUI() {
    document.body.classList.add('inactive');
    this.updateNonPersistentTabIndex(-1);
    this.actions.utilityWheel.disable();

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
    }, this.getCanvasAnimDurationInOut());
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

  // ---- Prompts ----
  dispatchPrompt(heading, onSubmit) {
    promptNode.header.textContent = heading;
    promptNode.submitButton.onclick = this.submitPrompt.bind(this, onSubmit);
    promptNode.wrapper.classList.add('active');
  }

  submitPrompt(callback) {
    this.removePrompt();
    callback();
  }
  removePrompt() {
    promptNode.wrapper.classList.remove('active');
  }

  preventPromptContext(e) {
    if (e.button === 2 && !e.shiftKey) {
      e.preventDefault();
    }
  }

  // ---- Notifications ----
  dispatchNotification(content, stickyLabel) {
    const notification = notificationTemplate.cloneNode(true);
    notification.textContent = content;
    notificationWrapper.appendChild(notification);
    if (!stickyLabel) {
      setTimeout(() => {
        this.#startNotificationRemoval(notification);
      }, 2000);
    } else {
      this.#stickyNotifications[stickyLabel] = notification;
    }
    return notification;
  }
  clearNotification(label) {
    if (label in this.#stickyNotifications) {
      const notification = this.#stickyNotifications[label];
      this.#startNotificationRemoval(notification);
      delete this.#stickyNotifications[label];
    }
  }
  #startNotificationRemoval(notification) {
    notification.classList.add('remove');
    setTimeout(() => {
      notification.remove();
    }, 200);
  }

  // ---- Animation timing getters ----
  getCanvasAnimDurationRemove() {
    return this.prefersReducedMotion ? 0 : CANVAS_ANIM_DURATION.REMOVE;
  }
  getCanvasAnimDurationInOut() {
    return this.prefersReducedMotion ? 0 : CANVAS_ANIM_DURATION.INOUT;
  }
}
