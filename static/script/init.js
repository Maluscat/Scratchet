'use strict';
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
const CANVAS_ANIM_DURATION = {
  REMOVE: 260,
  INOUT: 600
};

const LOCALSTORAGE_USERNAME_KEY = 'Scratchet_username';
const CURRENT_USER_ID = -1;

const SEND_FULL_METADATA_INTERVAL = 1000;
const BULK_INIT_SEPARATOR_LEN = 2;

// Metadata length in a payload of the specified mode, excluding the extra server metadata
const META_LEN = {
  NORMAL: 5,
  ERASE: 2,
};
// Length of additional metadata to and from the server
const EXTRA_META_LEN_SEND = 1; // room code
const EXTRA_META_LEN_RECEIVE = EXTRA_META_LEN_SEND + 1; // room code + userID

const META_FLAGS = {
  LAST_HUE: 0b0010,
  LAST_WIDTH: 0b0001
};

/*
 * data/socketData: bulk data received via socket
 * posData: self-contained metadata & position packet: [...metadata, pos1X, pos1Y, pos2X, pos2Y, ...]
 * posDataWrapper: wrapper for 1...n posData, used as pointer: [posData1, posData2, ...]
 * metadata: currently: [hue, width, lastPosX, lastPosY]
 */

const controller = new ScratchetController();
const controls3D = new Controls3D(null, null, {
  mod: {
    tran: 1,
  },
  buttons: {
    tran: 1,
    rot: null
  },
  dontInvertTranY: true,
  skipScaleKeyModifier: true,
  useProportionalScale: true
});
const ui = new UIHandler();

var Global;
let sock;


// ---- Wait for modules ----
import('./Global.mjs').then(module => {
  Global = module.default;

  joinRoomOverlayInput.pattern = Global.Validator.JOINROOM_VALIDATE_REGEX.toString().slice(1, -1);

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


// ---- Metadata helper functions ----
function getReceivedServerMetaMode(receivedServerDataWithMetadata) {
  return receivedServerDataWithMetadata[EXTRA_META_LEN_RECEIVE];
}
// Server data without extra server metadata
function getPendingServerMetaMode(pendingServerDataWithMetadata) {
  return pendingServerDataWithMetadata[EXTRA_META_LEN_SEND];
}

function getClientMetaHue(clientDataWithMetadata) {
  if (clientDataWithMetadata[0] >= 0) {
    return clientDataWithMetadata[0];
  }
  return false;
}
function getClientMetaWidth(clientDataWithMetadata, offset = 0) {
  // NOTE: This assumes that the width stays at position 1 in both normal & erase mode
  return clientDataWithMetadata[1 + offset];
}

// ---- Generic helper functions ----
function getExtraMetaLengthFromFlag(flag) {
  let extraLen = 0;
  if (flag & META_FLAGS.LAST_WIDTH) extraLen++;
  if (flag & META_FLAGS.LAST_HUE) extraLen++;
  return extraLen;
}

function createPosDataWrapper(posData) {
  return [ posData ];
}

function makeHSLString(hue, hasReducedAlpha) {
  if (hasReducedAlpha) {
    return `hsla(${hue}, 75%, 70%, .1)`;
  } else {
    return `hsl(${hue}, 75%, 70%)`;
  }
}

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
