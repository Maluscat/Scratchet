const notificationTemplate = (function() {
  const node = document.createElement('div');
  node.classList.add('notification');
  node.classList.add('button');
  return node;
}());

const canvasContainer = document.getElementById('canvas-container');

const notificationWrapper = document.getElementById('notification-overlay');
const drawIndicator = document.getElementById('draw-indicator');

const usernameInput = document.getElementById('username-input');
const userListButton = document.getElementById('user-list-button');
const userListWrapper = document.getElementById('user-list-wrapper');

const roomNameInput = document.getElementById('roomcode-input');
const roomListButton = document.getElementById('room-list-button');
const roomList = document.getElementById('room-list');

const newRoomButton = document.getElementById('new-room-button');
const joinRoomButton = document.getElementById('join-room-button');
const joinRoomOverlayInput = document.getElementById('join-room-overlay-input');
const copyRoomLinkButton = document.getElementById('copy-room-link-button');
const copyRoomLinkOverlay = document.getElementById('copy-room-link-overlay');
const copyRoomLinkContent = document.getElementById('copy-room-link-content');

const LOCALSTORAGE_USERNAME_KEY = 'Scratchet_username';
const JOINROOM_VALIDATE_REGEX = /^(?:(?:https?:\/\/)?\w+(?:\.\w+)*(?::\d{1,5})?(?:\/\w*?)*#)?(\d{4})$/;
const CURRENT_USER_ID = -1;
const SEND_INTERVAL = 40;
const MODE = {
  BULK_INIT: -1,
  ERASE: -2,
};
// Metadata length in a payload of the specified mode
const META_LEN = {
  NORMAL: 5,
  ERASE: 2,
}

/*
 * data/socketData: bulk data received via socket
 * posData: self-contained metadata & position packet: [...metadata, pos1X, pos1Y, pos2X, pos2Y, ...]
 * posDataWrapper: wrapper for 1...n posData, used as pointer: [posData1, posData2, ...]
 * metadata: currently: [hue, width, lastPosX, lastPosY]
 */

const sock = new WebSocket(`ws://${location.host}${location.pathname}socket`);

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


usernameInput.addEventListener('blur', e => {
  handleOverlayInput(e, controller.changeOwnUsername.bind(controller));
});
roomNameInput.addEventListener('blur', e => {
  handleOverlayInput(e, controller.changeCurrentRoomName.bind(controller));
});
for (const l of document.querySelectorAll('.overlay-input')) {
  l.addEventListener('keydown', handleOverlayInputKeys);
}

joinRoomOverlayInput.addEventListener('keydown', handleJoinRoomInputKeys);
joinRoomOverlayInput.addEventListener('paste', handleJoinRoomInputPaste);

userListButton.addEventListener('click', toggleHoverOverlay);
roomListButton.addEventListener('click', toggleHoverOverlay);
joinRoomButton.addEventListener('click', joinRoomButtonClick);
copyRoomLinkButton.addEventListener('click', controller.copyRoomLink.bind(controller));

sock.addEventListener('open', controller.socketOpen.bind(controller))
sock.addEventListener('message', controller.socketReceiveMessage.bind(controller));

window.addEventListener('wheel', mouseWheel);
window.addEventListener('resize', controller.windowResized.bind(controller));


joinRoomOverlayInput.pattern = JOINROOM_VALIDATE_REGEX.toString().slice(1, -1);

// ---- Events ----
function handleOverlayInputKeys(e) {
  if (e.key === 'Enter' || e.key === 'Escape') {
    e.currentTarget.blur();
  }
}
function handleOverlayInput(e, callback) {
  // From https://stackoverflow.com/a/30520997
  for (const brNode of e.currentTarget.getElementsByTagName('br')) {
    brNode.remove();
  }
  window.getSelection().removeAllRanges();
  callback(e.currentTarget.textContent);
}

function toggleHoverOverlay(e) {
  e.currentTarget.parentNode.querySelector('.hover-overlay').classList.toggle('active');
}

function mouseWheel(e) {
  if (!e.ctrlKey && e.deltaY !== 0) {
    const direction = -1 * (e.deltaY / Math.abs(e.deltaY)); // either 1 or -1
    if (e.shiftKey) {
      hueSlider.value += direction * 24;
    } else {
      widthSlider.value += direction * 7;
    }
  }
}

function joinRoomButtonClick() {
  joinRoomOverlayInput.classList.toggle('active');
  joinRoomOverlayInput.focus();
}
function collapseJoinRoomOverlay() {
  joinRoomOverlayInput.blur();
  joinRoomOverlayInput.classList.remove('active');
}
function handleJoinRoomInputKeys(e) {
  if (e.key === 'Escape' || e.key === 'Enter' && joinRoomOverlayInput.value === '') {
    collapseJoinRoomOverlay();
  }
  if (e.key === 'Enter') {
    submitJoinRoomInput();
  }
}
function handleJoinRoomInputPaste(e) {
  const value = (e.clipboardData || window.clipboardData).getData('text');
  // submitJoinRoomInput happens before the paste is applied to the input
  if (submitJoinRoomInput(value)) {
    e.preventDefault();
  }
}

function submitJoinRoomInput(value = joinRoomOverlayInput.value) {
  joinRoomOverlayInput.value = '';
  return controller.joinRoom(value);
}

// ---- Draw indicator ----
function toggleDrawIndicatorEraseMode(reset) {
  if (reset) {
    drawIndicator.classList.remove('erase');
  } else {
    drawIndicator.classList.add('erase');
  }
}
function moveDrawIndicator(posX, posY) {
  document.documentElement.style.setProperty('--mouseX', posX + 'px');
  document.documentElement.style.setProperty('--mouseY', posY + 'px');
}

// ---- Notifications ----
function dispatchNotification(content) {
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


// ---- Metadata helper functions ----
function getMetaMode(dataWithMetadata) {
  if (dataWithMetadata[0] < 0) {
    return dataWithMetadata[0];
  }
  return false;
}

function getMetaHue(dataWithMetadata) {
  if (dataWithMetadata[0] >= 0) {
    return dataWithMetadata[0];
  }
  return false;
}

function getMetaWidth(dataWithMetadata) {
  // NOTE: This assumes that the width stays at position 1 in both normal & erase mode
  return dataWithMetadata[1];
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

function sendMessage(event, value) {
  const dataObj = {
    evt: event
  };
  if (value != null) {
    dataObj.val = value;
  }
  sock.send(JSON.stringify(dataObj));
}
