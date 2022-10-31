'use strict';
var Global = import('./Global.mjs');

const canvasContainer = document.getElementById('canvas-container');

const clearDrawingButton = document.getElementById('clear-drawing-button');

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
const LOCALSTORAGE_USERNAME_KEY = 'Scratchet_username';
const CURRENT_USER_ID = -1;
const SEND_INTERVAL = 40;
const SEND_FULL_METADATA_INTERVAL = 1000;
const MODE = {
  BULK_INIT: -1,
  ERASE: -2,
};
// Metadata length in a payload of the specified mode, excluding the extra server metadata
const META_LEN = {
  NORMAL: 5,
  ERASE: 2,
}
// Length of the additional metadata for the server, currently the userID
const EXTRA_SERVER_META_LEN = 1;

/*
 * data/socketData: bulk data received via socket
 * posData: self-contained metadata & position packet: [...metadata, pos1X, pos1Y, pos2X, pos2Y, ...]
 * posDataWrapper: wrapper for 1...n posData, used as pointer: [posData1, posData2, ...]
 * metadata: currently: [hue, width, lastPosX, lastPosY]
 */

const hueSlider = new Slider89(document.getElementById('hue-slider'), {
  range: [0, 360],
  precision: 0,
  structure: `
    <thumb>
      <:indicator class=[slider-hue-indicator] style=[background-color: ${makeHSLString('$value')};]>
    </thumb>
  `
}, true);

const widthSlider = new Slider89(document.getElementById('width-slider'), {
  range: [1, 80],
  value: 25,
  precision: 0,
  structure: `
    <thumb>
      <:value "$value" class=[slider-width-value]>
    </thumb>
  `
}, true);

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

let sock;


// ---- Wait for modules ----
Global.then(module => {
  Global = module.default;

  joinRoomOverlayInput.pattern = Global.Validator.JOINROOM_VALIDATE_REGEX.toString().slice(1, -1);

  sock = new WebSocket(`ws://${location.host}${location.pathname}socket`);
  sock.addEventListener('open', controller.socketOpen.bind(controller))
  sock.addEventListener('message', controller.socketReceiveMessage.bind(controller));
});



// ---- Metadata helper functions ----
function getReceivedServerMetaMode(receivedServerDataWithMetadata) {
  return receivedServerDataWithMetadata[1 + EXTRA_SERVER_META_LEN];
}
// Server data without extra server metadata
function getPendingServerMetaMode(pendingServerDataWithMetadata) {
  return pendingServerDataWithMetadata[1];
}

function getClientMetaHue(clientDataWithMetadata) {
  if (clientDataWithMetadata[0] >= 0) {
    return clientDataWithMetadata[0];
  }
  return false;
}
function getClientMetaWidth(clientDataWithMetadata) {
  // NOTE: This assumes that the width stays at position 1 in both normal & erase mode
  return clientDataWithMetadata[1];
}

// ---- Generic helper functions ----
function getExtraMetaLengthFromFlag(flag) {
  let extraLen = 0;
  if (flag & 0b0001) extraLen++;
  if (flag & 0b0010) extraLen++;
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
