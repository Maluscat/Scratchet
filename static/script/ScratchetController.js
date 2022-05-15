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

    // Set the join room input to the same width as the copy room link overlay
    copyRoomLinkOverlay.classList.add('active');
    joinRoomOverlayInput.style.maxWidth =
      (copyRoomLinkContent.offsetWidth / parseFloat(getComputedStyle(copyRoomLinkContent).fontSize)) + 'em';
    copyRoomLinkOverlay.classList.remove('active');

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

  joinRoom(roomcode) {
    roomcode = ScratchetRoom.validateValueToRoomCode(roomcode);
    if (roomcode) {
      collapseJoinRoomOverlay();
    }
    return !!roomcode;
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
    this.activeRoom.nameHandler.setUsernameInput();
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

    room.nameHandler.setUsernameInput();
    room.nameHandler.appendUserList();
    room.nameHandler.updateUserIndicator();

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
      const posData = new Int16Array(this.posBuffer);
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

  parseSocketData(data) {
    const userID = data[0];
    data = data.subarray(1);

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

  // ---- Socket message events ----
  userDisconnect(userID) {
    const username = this.activeRoom.nameHandler.removeUserFromUserList(userID);

    this.activeRoom.clearUserBufferAndRedraw(userID);
    this.activeRoom.posUserCache.delete(userID);

    dispatchNotification(`${username} has left the room`);
  }
  userConnect(userID, value) {
    this.activeRoom.nameHandler.addUserToUserList(userID, value.name);

    this.activeRoom.sendJoinedUserBuffer();

    dispatchNotification(`${value.name} has entered the room`);
  }
  userClearData(userID) {
    this.activeRoom.clearUserBufferAndRedraw(userID);
  }
  userChangeName(userID, newUsername) {
    const prevUsername = this.activeRoom.nameHandler.getUsername(userID);
    const username = this.activeRoom.nameHandler.changeUsername(userID, newUsername);

    dispatchNotification(`${prevUsername} --> ${username}`);
  }

  ownUserGetConnectData(value) {
    // For async reasons, the real user ID is solely used for the username
    if (!this.defaultOwnUsername) {
      this.setDefaultUsername(value.name);
    }
    this.addNewRoom(value.room, value.peers, true);
    this.init();
  }

  // ---- Socket events ----
  socketOpen() {
    console.info('connected!');

    const initValue = {};
    if (this.defaultOwnUsername) {
      initValue.name = this.defaultOwnUsername;
    }
    sendMessage('connectInit', initValue);
  }

  async socketReceiveMessage(e) {
    if (e.data instanceof Blob) {
      // Scratchet ArrayBuffer: [playerID, metadata?, ...positions]
      const data = new Int16Array(await e.data.arrayBuffer());
      this.parseSocketData(data);
    } else {
      const data = JSON.parse(e.data);
      switch (data.evt) {
        case 'disconnect': {
          this.userDisconnect(data.usr);
          break;
        }
        case 'connect': {
          this.userConnect(data.usr, data.val);
          break;
        }
        case 'clearUser': {
          this.userClearData(data.usr);
          break;
        }
        case 'changeName': {
          this.userChangeName(data.usr, data.val);
          break;
        }
        case 'connectData': {
          this.ownUserGetConnectData(data.val);
          break;
        }
      }
    }
  }
}
