const notificationTemplate = (function() {
  const node = document.createElement('div');
  node.classList.add('notification');
  node.classList.add('button');
  return node;
}());

const canvas = document.getElementById('canvas');
const notificationWrapper = document.getElementById('notification-overlay');
const drawIndicator = document.getElementById('draw-indicator');;

const CURRENT_USER_ID = -1;
const SEND_INTERVAL = 100;
const ERASE_THRESHOLD = 35;

const ctx = canvas.getContext('2d');
const posUserCache = new Map(); // Map<userID, Set<posDataForUser>>
const globalPosBuffer = new Set(); // Set<posDataInOrderOfInsertion>
const lastPos = new Array(2);
let pressedMouseBtn = -1;
let posBuffer = new Array();


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
hueSlider.addEvent('change:value', () => setStrokeStyle());

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
widthSlider.addEvent('change:value', () => setLineWidth());
// Mist.
// widthSlider.addEvent('move', (slider, e) => {
//   if (e.ctrlKey) {
//     if (slider.step === false) {
//       slider.step = 10;
//     }
//   } else {
//     slider.step = false;
//   }
// });


document.getElementById('clear-button').addEventListener('click', clearCurrentUserCanvas);

sock.addEventListener('open', socketOpen);
sock.addEventListener('message', socketReceiveMessage);

canvas.addEventListener('contextmenu', canvasContext);

canvas.addEventListener('pointerdown', canvasDown);
window.addEventListener('pointerup', pointerUp);
canvas.addEventListener('mousemove', canvasDraw);


canvas.height = canvas.clientHeight;
canvas.width = canvas.clientWidth;

ctx.lineCap = 'round';
ctx.lineJoin = 'round';
setStrokeStyle();
setLineWidth();

setInterval(sendPositions, SEND_INTERVAL);


// ---- Events ----
function canvasContext(e) {
  if (e.button === 2) {
    e.preventDefault();
  }
}

function canvasDown(e) {
  pressedMouseBtn = e.button;
  if (pressedMouseBtn === 2) {
    toggleDrawIndicatorEraseMode();
  }
  setLastPos(e.clientX, e.clientY);
  resetPosBuffer();
  canvasDraw(e);
}

function pointerUp() {
  sendPositions();
  pressedMouseBtn = -1;
  toggleDrawIndicatorEraseMode(true);
}

function canvasDraw(e) {
  moveDrawIndicator(e.clientX, e.clientY);
  if (pressedMouseBtn >= 0) {
    if (pressedMouseBtn === 2) {
      erasePosData(e.clientX, e.clientY, CURRENT_USER_ID);
      redrawCanvas();
    } else {
      // Overrule timer if hue or stroke width has changed
      if (hueSlider.value !== posBuffer[0] || widthSlider.value !== posBuffer[1]) {
        sendPositions();
      }

      ctx.beginPath();
      ctx.moveTo(...lastPos);
      ctx.lineTo(e.clientX, e.clientY);
      ctx.stroke();

      setLastPos(e.clientX, e.clientY);
    }
    posBuffer.push(e.clientX, e.clientY);

    // hueSlider.value = (hueSlider.value + 1) % 360;
    // if (Math.round(Math.random()) === 0 || widthSlider.value <= 1) {
    //   widthSlider.value++;
    // } else {
    //   widthSlider.value--;
    // }
  }
}

// ---- Canvas ----
function redrawCanvas() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (const { value: posData } of globalPosBuffer) {
    drawFromData(posData);
  }
}

function clearCurrentUserCanvas() {
  sendMessage('clearUser');
  clearUserBufferAndRedraw(CURRENT_USER_ID);
}

function drawFromData(data) {
  setStrokeStyle(data[0]);
  setLineWidth(data[1]);

  ctx.beginPath();
  ctx.moveTo(data[2], data[3]);
  for (let i = 4; i < data.length; i += 2) {
    ctx.lineTo(data[i], data[i + 1]);
  }
  ctx.stroke();

  setStrokeStyle();
  setLineWidth();
}
function drawFromDataAndAddToBuffer(dataArr, userID) {
  drawFromData(dataArr);
  addPosDataToBuffer(userID, dataArr);
}

// --- Canvas helper functions ---
function setLineWidth(width = widthSlider.value) {
  ctx.lineWidth = width;
  if (width === widthSlider.value) {
    drawIndicator.style.width = (widthSlider.value) + 'px';
    drawIndicator.style.height = (widthSlider.value) + 'px';
  }
}
function setStrokeStyle(hue = hueSlider.value) {
  ctx.strokeStyle = makeHSLString(hue);
}
function makeHSLString(hue = hueSlider.value) {
  return `hsl(${hue}, 75%, 70%)`
}

function moveDrawIndicator(posX, posY) {
  drawIndicator.style.transform =
    `translate(${posX - widthSlider.value / 2}px, ${posY - widthSlider.value / 2}px)`;
}
function toggleDrawIndicatorEraseMode(reset) {
  if (reset) {
    drawIndicator.classList.remove('erase');
  } else {
    drawIndicator.classList.add('erase');
  }
}

function setLastPos(posX, posY) {
  lastPos[0] = posX;
  lastPos[1] = posY;
}
function resetPosBuffer() {
  if (pressedMouseBtn === 2) {
    posBuffer = [-2];
  } else {
    posBuffer = [hueSlider.value, ctx.lineWidth, ...lastPos];
  }
}


// ---- Buffer functions ----
function parseBufferData(data, userID) {
  if (data[0] === -1) {
    // Bulk init data
    handleBulkInitData(data, userID);
  } else {
    drawFromDataAndAddToBuffer(data, userID);
  }
}
function handleBulkInitData(data, userID) {
  let index = 1;
  for (let i = 0; i < data.length; i++) {
    if (data[i] === -1) {
      drawFromDataAndAddToBuffer(data.subarray(index, i), userID);
      index = i + 1;
    }
  }
  drawFromDataAndAddToBuffer(data.subarray(index), userID);
}

function addPosDataToBuffer(userID, posData) {
  posData = createPosDataWrapper(posData);
  globalPosBuffer.add(posData);
  let cache = posUserCache.get(userID);
  if (!cache) {
    cache = new Set();
    posUserCache.set(userID, cache);
  }
  cache.add(posData);
}

function clearUserBufferAndRedraw(userID) {
  const userCache = posUserCache.get(userID);
  if (userCache) {
    for (const posDataWrapper of userCache) {
      globalPosBuffer.delete(posDataWrapper);
    }
    userCache.clear();
  }
  redrawCanvas();
}

function sendJoinedUserBuffer(targetUserID) {
  if (posUserCache.has(CURRENT_USER_ID)) {
    const joinedBuffer = new Array();
    for (const { value: posData } of posUserCache.get(CURRENT_USER_ID)) {
      joinedBuffer.push(-1, ...posData);
    }
    sock.send(new Int32Array(joinedBuffer));
  }
}

function createPosDataWrapper(posData) {
  return {
    value: posData
  };
}


// ---- Socket ----
function sendPositions() {
  if (posBuffer.length > 4) {
    const data = new Int32Array(posBuffer);
    sock.send(data.buffer);
    if (pressedMouseBtn !== 2) {
      addPosDataToBuffer(CURRENT_USER_ID, data);
    }
    resetPosBuffer();
  }
}

function socketOpen() {
  console.info('connected!');
}

async function socketReceiveMessage(e) {
  if (e.data instanceof Blob) {
    // Scratchet ArrayBuffer: [playerID, hue, lineWidth, lastPosX, lastPosY, ...positions]
    const data = new Int32Array(await e.data.arrayBuffer());
    const userID = data[0];

    parseBufferData(data.subarray(1), userID);
  } else {
    const data = JSON.parse(e.data);
    switch (data.evt) {
      case 'disconnect':
        console.info(data.usr + ' disconnected');
        dispatchNotification(`User #${data.usr} has left the room`)
        clearUserBufferAndRedraw(data.usr);
        posUserCache.delete(data.usr);
        break;
      case 'connect':
        console.info(data.usr + ' connected, sending my data');
        dispatchNotification(`User #${data.usr} has entered the room`)
        sendJoinedUserBuffer();
        break;
      case 'clearUser':
        console.info(data.usr + ' cleared their drawing');
        clearUserBufferAndRedraw(data.usr);
        break;
    }
  }
}

// --- Helper functions ---
function sendMessage(event, value) {
  const data = {
    evt: event
  };
  if (value != null) {
    data.val = value;
  }
  sock.send(JSON.stringify(data));
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
