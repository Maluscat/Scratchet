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
  windowResized() {
    for (const room of this.rooms.values()) {
      room.setDimensions();
      room.redrawCanvas();
    }
  }

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

  // ---- Socket receiving ----
  parseSocketData(data, userID) {
    switch (getMetaMode(data)) {
      case MODE.BULK_INIT:
        this.activeRoom.handleBulkInitData(data, userID);
        break;
      case MODE.ERASE:
        this.activeRoom.handleEraseData(data, userID);
        break;
      default:
        nameHandler.setUserColorIndicator(userID, getMetaHue(data));
        this.activeRoom.addPosDataToBuffer(data, userID);
        this.activeRoom.redrawCanvas();
    }
  }

  // ---- Socket events ----
  socketOpen() {
    console.info('connected!');
    const ownUsername = nameHandler.getOwnUsername();
    if (ownUsername) {
      sendMessage('changeName', ownUsername);
    }
  }

  async socketReceiveMessage(e) {
    if (e.data instanceof Blob) {
      // Scratchet ArrayBuffer: [playerID, metadata?, ...positions]
      const data = new Int32Array(await e.data.arrayBuffer());
      const userID = data[0];

      this.parseSocketData(data.subarray(1), userID);
    } else {
      const data = JSON.parse(e.data);
      switch (data.evt) {
        case 'disconnect': {
          console.info(data.usr + ' disconnected');

          const username = nameHandler.removeUserFromUserList(data.usr);
          dispatchNotification(`${username} has left the room`);

          this.activeRoom.clearUserBufferAndRedraw(data.usr);
          this.activeRoom.posUserCache.delete(data.usr);
          break;
        }
        case 'connect': {
          console.info(data.usr + ' connected, sending my data');

          const username = nameHandler.addUserToUserList(data.usr);
          dispatchNotification(`${username} has entered the room`);

          this.activeRoom.sendJoinedUserBuffer();
          break;
        }
        case 'clearUser': {
          console.info(data.usr + ' cleared their drawing');
          this.activeRoom.clearUserBufferAndRedraw(data.usr);
          break;
        }
        case 'changeName': {
          const prevUsername = nameHandler.getUsername(data.usr);
          const username = nameHandler.changeUsername(data.usr, data.val);
          dispatchNotification(`${prevUsername} --> ${username}`);
          break;
        }
        case 'connectData': {
          // For async reasons, the real user ID is solely used for the username
          if (!nameHandler.getOwnUsername()) {
            nameHandler.initOwnUsername(data.val.name);
          }
          for (const [userID, username] of data.val.peers) {
            nameHandler.addUserToUserList(userID, username);
          }

          this.addNewRoom(data.val.room, nameHandler.getOwnUsername(), true);
          this.init();
          break;
        }
      }
    }
  }
}
