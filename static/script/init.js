const notificationTemplate = (function() {
  const node = document.createElement('div');
  node.classList.add('notification');
  node.classList.add('button');
  return node;
}());

const notificationWrapper = document.getElementById('notification-overlay');
const drawIndicator = document.getElementById('draw-indicator');

const usernameInput = document.getElementById('username-input');
const userList = document.getElementById('user-list');
const userListOverlay = document.getElementById('user-list-overlay');
const userListButton = document.getElementById('user-list-button');

const LOCALSTORAGE_USERNAME_KEY = 'Scratchet_username';
const CURRENT_USER_ID = -1;
const SEND_INTERVAL = 100;

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

const mainCanvas = new ScratchetCanvas(document.getElementById('canvas'));
const nameHandler = new UsernameHandler(usernameInput, userList, userListButton);


usernameInput.addEventListener('blur', e => {
  handleOverlayInput(e, nameHandler.changeOwnUsername.bind(nameHandler));
});
for (const l of document.querySelectorAll('.overlay-input')) {
  l.addEventListener('keydown', handleOverlayInputKeys);
}

userListButton.addEventListener('click', toggleUserList);

hueSlider.addEvent('change:value', () => mainCanvas.setStrokeStyle());
widthSlider.addEvent('change:value', () => mainCanvas.setLineWidth());
document.getElementById('clear-button').addEventListener('click', mainCanvas.clearCurrentUserCanvas.bind(mainCanvas));

sock.addEventListener('open', socketOpen);
sock.addEventListener('message', socketReceiveMessage);

window.addEventListener('wheel', mouseWheel);

setInterval(sendPositions, SEND_INTERVAL);


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

function toggleUserList(e) {
  userListOverlay.classList.toggle('active');
}

function mouseWheel(e) {
  if (!e.ctrlKey && e.deltaY !== 0) {
    const direction = -1 * (e.deltaY / Math.abs(e.deltaY)); // either 1 or -1
    widthSlider.value += direction * 7;
  }
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

// ---- Buffer functions ----
function parseSocketData(data, userID) {
  if (data[0] === -1) {
    // Bulk init data
    mainCanvas.handleBulkInitData(data, userID);
  } else if (data[0] === -2) {
    // Erased data
    mainCanvas.handleEraseData(data, userID);
  } else {
    mainCanvas.addPosDataToBufferAndDraw(data, userID);
  }
}

function createPosDataWrapper(posData) {
  return [ posData ];
}


// ---- Socket ----
function sendPositions() {
  if (mainCanvas.posBuffer[0] === -2 && mainCanvas.posBuffer.length > 2 || mainCanvas.posBuffer.length > 4) {
    const posData = new Int32Array(mainCanvas.posBuffer);
    sock.send(posData.buffer);
    if (mainCanvas.posBuffer[0] >= 0) {
      mainCanvas.addPosDataToBuffer(posData, CURRENT_USER_ID);
    }
    mainCanvas.resetPosBuffer();
  }
}
// Overrule timer if hue or stroke width has changed
function sendPositionsIfWidthHasChanged() {
  // NOTE: This assumes that the width stays at position 1 in both normal & erase mode
  if (widthSlider.value !== mainCanvas.posBuffer[1]) {
    sendPositions();
  }
}
function sendPositionsIfHueHasChanged() {
  if (hueSlider.value !== mainCanvas.posBuffer[0]) {
    sendPositions();
  }
}

function socketOpen() {
  console.info('connected!');
  const ownUsername = nameHandler.getOwnUsername();
  if (ownUsername) {
    sendMessage('changeName', ownUsername);
  }
}

async function socketReceiveMessage(e) {
  if (e.data instanceof Blob) {
    // Scratchet ArrayBuffer: [playerID, metadata?, ...positions]
    const data = new Int32Array(await e.data.arrayBuffer());
    const userID = data[0];

    parseSocketData(data.subarray(1), userID);
  } else {
    const data = JSON.parse(e.data);
    switch (data.evt) {
      case 'disconnect':
        console.info(data.usr + ' disconnected');

        var usrname = nameHandler.removeUserFromUserList(data.usr);
        dispatchNotification(`${usrname} has left the room`);

        mainCanvas.clearUserBufferAndRedraw(data.usr);
        mainCanvas.posUserCache.delete(data.usr);
        break;
      case 'connect':
        console.info(data.usr + ' connected, sending my data');

        var usrname = nameHandler.addUserToUserList(data.usr);
        dispatchNotification(`${usrname} has entered the room`);

        mainCanvas.sendJoinedUserBuffer();
        break;
      case 'clearUser':
        console.info(data.usr + ' cleared their drawing');
        mainCanvas.clearUserBufferAndRedraw(data.usr);
        break;
      case 'changeName':
        var prevUsrname = nameHandler.getUsername(data.usr);
        var usrname = nameHandler.changeUsername(data.usr, data.val);
        dispatchNotification(`${prevUsrname} --> ${usrname}`);
        break;
      case 'connectData':
        // For async reasons, the real user ID is solely used for the username
        if (!nameHandler.getOwnUsername()) {
          nameHandler.initOwnUsername(data.val.name);
        }
        for (const [userID, username] of data.val.peers) {
          nameHandler.addUserToUserList(userID, username);
        }
        break;
    }
  }
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

// ---- Helper functions ----
function makeHSLString(hue = hueSlider.value) {
  return `hsl(${hue}, 75%, 70%)`
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

