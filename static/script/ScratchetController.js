class ScratchetController {
  canvas;

  rooms = new Map();
  activeRoom;

  posBuffer = new Array();

  constructor(canvas) {
    this.canvas = canvas;
  }

  init() {
    hueSlider.addEvent('change:value', () => this.activeRoom.setStrokeStyle());
    widthSlider.addEvent('change:value', () => this.activeRoom.setLineWidth());
    document.getElementById('clear-button').addEventListener('click', this.activeRoom.clearCurrentUserCanvas.bind(this.activeRoom));

    setInterval(this.sendPositions.bind(this), SEND_INTERVAL);
  }

  // ---- Event handling ----
  async copyRoomLink() {
    navigator.clipboard.writeText(this.activeRoom.roomCodeLink);
    copyRoomLinkOverlay.classList.add('copied');
    setTimeout(function() {
      copyRoomLinkOverlay.classList.remove('copied');
    }, 750);
  }

  changeCurrentRoomName(newRoomName) {
    this.activeRoom.changeRoomName(newRoomName);
  }

  roomListNodeClick(room) {
    this.switchActiveRoom(room);
  }

  // ---- Room handling ----
  addNewRoom(roomCode, ownUsername, activate) {
    const newRoom = new ScratchetRoom(this.canvas, roomCode, ownUsername);
    roomNameInput.textContent = newRoom.roomName;

    newRoom.roomListNode.addEventListener('click', this.roomListNodeClick.bind(this, newRoom));
    roomList.appendChild(newRoom.roomListNode);

    this.rooms.set(roomCode, newRoom);
    this.updateRoomIndicator();
    if (activate) {
      this.switchActiveRoom(newRoom);
    }
  }

  switchActiveRoom(room) {
    this.activeRoom = room;
    copyRoomLinkContent.textContent = room.roomCodeLink;
  }

  updateRoomIndicator() {
    roomListButton.textContent = this.rooms.size;
  }

  // ---- Canvas handling ----
  highlightUser(userID) {
    this.activeRoom.redrawCanvas(this.activeRoom.posUserCache.get(userID));
  }

  addToPosBuffer(posX, posY) {
    this.posBuffer.push(posX, posY);
  }

  initializePosBuffer(useEraseMode, lastPosX, lastPosY) {
    if (useEraseMode) {
      this.posBuffer = [MODE.ERASE, widthSlider.value];
    } else {
      this.posBuffer = [hueSlider.value, widthSlider.value, lastPosX, lastPosY];
    }
  }

  resetPosBuffer() {
    this.initializePosBuffer(
      getMetaMode(this.posBuffer) === MODE.ERASE,
      this.posBuffer[this.posBuffer.length - 2],
      this.posBuffer[this.posBuffer.length - 1]
    );
  }

  // ---- Socket handling ----
  sendPositions() {
    if (getMetaMode(this.posBuffer) === MODE.ERASE && this.posBuffer.length > META_LEN.ERASE
        || this.posBuffer.length > META_LEN.NORMAL) {
      const posData = new Int32Array(this.posBuffer);
      sock.send(posData.buffer);
      if (!getMetaMode(this.posBuffer)) {
        this.activeRoom.addPosDataToBuffer(posData, CURRENT_USER_ID);
      }
      this.resetPosBuffer();
    }
  }

  // Overrule timer if hue or stroke width has changed
  sendPositionsIfWidthHasChanged() {
    if (widthSlider.value !== getMetaWidth(this.posBuffer)) {
      this.sendPositions();
    }
  }
  sendPositionsIfHueHasChanged() {
    if (hueSlider.value !== getMetaHue(this.posBuffer)) {
      this.sendPositions();
    }
  }
}
