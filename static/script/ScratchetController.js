class ScratchetController {
  defaultOwnUsername;

  rooms = new Map();
  activeRoom;

  posBuffer = new Array();

  constructor() {
    const persistentUsername = localStorage.getItem(LOCALSTORAGE_USERNAME_KEY);
    if (persistentUsername) {
      this.setDefaultUsername(persistentUsername, true);
    }

    hueSlider.addEvent('change:value', this.changeHue.bind(this));
    widthSlider.addEvent('change:value', this.changeWidth.bind(this));
  }

  init() {
    document.getElementById('clear-button').addEventListener('click', this.activeRoom.clearCurrentUserCanvas.bind(this.activeRoom));

    setInterval(this.sendPositions.bind(this), SEND_INTERVAL);
  }

  // ---- Event handling ----
  changeHue(slider) {
    this.activeRoom.setStrokeStyle(slider.value);
    this.activeRoom.hue = slider.value;
  }
  changeWidth(slider) {
    this.activeRoom.setLineWidth(slider.value);
    this.activeRoom.width = slider.value
    document.documentElement.style.setProperty('--strokeWidth', slider.value + 'px');
  }

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

  changeOwnUsername(newUsername) {
    if (/^[Uu]ser #\d+$/.test(newUsername)) {
      this.resetUsernameInput();
    } else if (newUsername !== this.activeRoom.nameHandler.getUsername(CURRENT_USER_ID)) {
      this.activeRoom.nameHandler.changeUsername(CURRENT_USER_ID, newUsername);
      this.setDefaultUsername(newUsername);
      sendMessage('changeName', newUsername);
    }
  }

  // ---- Username handling ----
  resetUsernameInput() {
    localStorage.removeItem(LOCALSTORAGE_USERNAME_KEY);
    usernameInput.textContent = this.activeRoom.nameHandler.getUsername(CURRENT_USER_ID);
  }
  setDefaultUsername(username, skipLocalStorage) {
    this.defaultOwnUsername = username;
    if (!skipLocalStorage) {
      localStorage.setItem(LOCALSTORAGE_USERNAME_KEY, username);
    }
  }

  // ---- Room handling ----
  addNewRoom(roomCode, peers, activate) {
    if (!this.defaultOwnUsername) {
      throw new Error('@ addNewRoom: No default username has been set');
    }

    const newRoom = new ScratchetRoom(roomCode, this.defaultOwnUsername, peers);
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
      this.posBuffer = [MODE.ERASE, this.activeRoom.width];
    } else {
      this.posBuffer = [this.activeRoom.hue, this.activeRoom.width, lastPosX, lastPosY];
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
    if (this.activeRoom.width !== getMetaWidth(this.posBuffer)) {
      this.sendPositions();
    }
  }
  sendPositionsIfHueHasChanged() {
    if (this.activeRoom.hue !== getMetaHue(this.posBuffer)) {
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
        this.activeRoom.nameHandler.setUserColorIndicator(userID, getMetaHue(data));
        this.activeRoom.addPosDataToBuffer(data, userID);
        this.activeRoom.redrawCanvas();
    }
  }

  // ---- Socket events ----
  socketOpen() {
    console.info('connected!');
    if (this.defaultOwnUsername) {
      sendMessage('changeName', this.defaultOwnUsername);
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

          const username = this.activeRoom.nameHandler.removeUserFromUserList(data.usr);
          dispatchNotification(`${username} has left the room`);

          this.activeRoom.clearUserBufferAndRedraw(data.usr);
          this.activeRoom.posUserCache.delete(data.usr);
          break;
        }
        case 'connect': {
          console.info(data.usr + ' connected, sending my data');

          const username = this.activeRoom.nameHandler.addUserToUserList(data.usr);
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
          const prevUsername = this.activeRoom.nameHandler.getUsername(data.usr);
          const username = this.activeRoom.nameHandler.changeUsername(data.usr, data.val);
          dispatchNotification(`${prevUsername} --> ${username}`);
          break;
        }
        case 'connectData': {
          // For async reasons, the real user ID is solely used for the username
          if (!this.defaultOwnUsername) {
            this.setDefaultUsername(data.val.name);
          }
          this.addNewRoom(data.val.room, data.val.peers, true);
          this.init();
          break;
        }
      }
    }
  }
}
