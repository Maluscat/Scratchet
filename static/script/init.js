'use strict';
/** @typedef { import('./shared/Global.mjs') } ScratchetGlobal */
/** @typedef { import('./shared/Validator.mjs') } Validator */

const canvasContainer = document.getElementById('canvas-container');

const usernameInput = document.getElementById('username-input');
const userListButton = document.getElementById('user-list-button');
const userListWrapper = document.getElementById('user-list-wrapper');

const roomNameInput = document.getElementById('roomcode-input');
const roomListButton = document.getElementById('room-list-button');
const roomList = document.getElementById('room-list');

const joinRoomOverlayInput =
  /** @type {HTMLInputElement} */ (document.getElementById('join-room-overlay-input'));
const copyRoomLinkOverlay = document.getElementById('copy-room-link-overlay');
const copyRoomLinkContent = document.getElementById('copy-room-link-content');

const OVERLAY_INPUT_INVALID_DURATION = 365;
const HIT_BORDER_DURATION = 200;
const CANVAS_ANIM_DURATION = /** @type const */ ({
  REMOVE: 260,
  INOUT: 600
});

const LOCALSTORAGE_USERNAME_KEY = 'Scratchet_username';
const CURRENT_USER_ID = -1;

const SEND_FULL_METADATA_INTERVAL = 1000;
const BULK_INIT_SEPARATOR_LEN = 2;

/*
 * data/socketData: bulk data received via socket
 * posData: self-contained metadata & position packet: [...metadata, pos1X, pos1Y, pos2X, pos2Y, ...]
 * posDataWrapper: wrapper for 1...n posData, used as pointer: [posData1, posData2, ...]
 * metadata: currently: [hue, width, lastPosX, lastPosY]
 */

const controller = new Controller();
const controls3D = new Controls3D(null, null, {
  mod: {
    tran: 1,
  },
  buttons: {
    tran: 1,
    rot: null
  },
  dontInvertTranY: true,
  keyModifier: {
    scale: {
      x: [ ['ctrlKey'] ],
      y: [ ['ctrlKey'] ],
    }
  }
});
const ui = new UIHandler();

/** @type { WebSocket } */
let sock;

/** @type { ScratchetGlobal } */
var Global;
/** @type { Validator } */
var Validator;


// ---- Wait for modules ----
Promise.all([
  import('./shared/Global.mjs'),
  import('./shared/Validator.mjs'),
]).then(([ MetaModule, ValidatorModule ]) => {
  Global = MetaModule;
  Validator = ValidatorModule;

  joinRoomOverlayInput.pattern = Validator.JOINROOM_VALIDATE_REGEX.toString().slice(1, -1);

  sock = new WebSocket(`ws://${location.host}${location.pathname}socket`);
  sock.addEventListener('open', controller.socketOpen.bind(controller))
  sock.addEventListener('message', controller.socketReceiveMessage.bind(controller));

  controller.init();
});



// ---- Animation timing getters ----
function getCanvasAnimDurationRemove() {
  return ui.prefersReducedMotion ? 0 : CANVAS_ANIM_DURATION.REMOVE;
}
function getCanvasAnimDurationInOut() {
  return ui.prefersReducedMotion ? 0 : CANVAS_ANIM_DURATION.INOUT;
}


// ---- Generic helper functions ----
function sendMessage(event, value, roomCode) {
  const dataObj = {
    evt: event
  };
  if (roomCode != null) {
    dataObj.room = roomCode;
  }
  if (value != null) {
    dataObj.val = value;
  }
  sock.send(JSON.stringify(dataObj));
}
