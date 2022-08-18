class ScratchetController {
  ownUsername;
  defaultUsername;

  isInitialized = false;

  rooms = new Map();
  activeRoom;

  posBufferServer = new Array();
  posBufferClient = new Array();
  willSendCompleteMetaData = true;

  constructor() {
    const persistentUsername = localStorage.getItem(LOCALSTORAGE_USERNAME_KEY);
    if (persistentUsername) {
      this.ownUsername = persistentUsername;
    }
  }

  init() {
    hueSlider.addEvent('change:value', this.changeHue.bind(this));
    widthSlider.addEvent('change:value', this.changeWidth.bind(this));
    clearDrawingButton.addEventListener('click', this.clearDrawing.bind(this));

    // Set the join room input to the same width as the copy room link overlay
    copyRoomLinkOverlay.classList.add('active');
    joinRoomOverlayInput.style.maxWidth =
      (copyRoomLinkContent.offsetWidth / parseFloat(getComputedStyle(copyRoomLinkContent).fontSize)) + 'em';
    copyRoomLinkOverlay.classList.remove('active');

    setInterval(this.sendPositions.bind(this), SEND_INTERVAL);
    setInterval(this.sendCompleteMetaDataNextTime.bind(this), SEND_FULL_METADATA_INTERVAL);

    this.isInitialized = true;
  }

  // ---- Event handling ----
  // TODO fallback for an undefined `activeRoom` in case no rooms are active
  changeHue(slider) {
    this.activeRoom.setStrokeStyle(slider.value);
    this.activeRoom.hue = slider.value;
  }
  changeWidth(slider) {
    this.activeRoom.setLineWidth(slider.value);
    this.activeRoom.width = slider.value
    document.documentElement.style.setProperty('--strokeWidth', slider.value + 'px');
  }

  clearDrawing() {
    this.activeRoom.clearCurrentUserCanvas();
    this.sendCompleteMetaDataNextTime();
    sendMessage('clearUser', null, this.activeRoom.roomCode);
  }

  windowResized() {
    for (const room of this.rooms.values()) {
      room.setDimensions();
      room.redrawCanvas();
    }
  }

  joinRoom(roomInputValue) {
    const roomCode = Validator.validateRoomInputValueToRoomCode(roomInputValue);
    if (roomCode) {
      sendMessage('joinRoom', roomCode);
      collapseJoinRoomOverlay();
    }
    return !!roomCode;
  }

  async copyRoomLink() {
    if (!navigator.clipboard) {
      copyRoomLinkOverlay.classList.toggle('active');
      return;
    }

    await navigator.clipboard.writeText(this.activeRoom.roomCodeLink);

    if (matchMedia('(hover: hover)').matches) {
      copyRoomLinkOverlay.classList.add('copied');
      dispatchTimeout();
    } else {
      copyRoomLinkOverlay.classList.toggle('active');
      if (copyRoomLinkOverlay.classList.contains('active')) {
        setTimeout(function() {
          copyRoomLinkOverlay.classList.add('copied');
          dispatchTimeout();
        }, 175);
      }
    }

    function dispatchTimeout() {
      setTimeout(function() {
        copyRoomLinkOverlay.classList.remove('copied');
      }, 750);
    }
  }

  changeCurrentRoomName(newRoomName) {
    this.activeRoom.changeRoomName(newRoomName);
  }

  roomListNodeClick(room) {
    this.switchActiveRoom(room);
  }

  changeOwnUsername(newUsername) {
    newUsername = newUsername.trim();
    if (newUsername === '') {
      this.resetUsernameToDefault();
    } else if (!Validator.validateUsername(newUsername)) {
      // TODO Clip the username at 20 characters instead of resetting it
      this.resetUsernameInput();
    } else if (newUsername !== this.activeRoom.nameHandler.getUsername(CURRENT_USER_ID)) {
      this.setOwnUsername(newUsername);
    }
  }

  // ---- Username handling ----
  resetUsernameToDefault() {
    localStorage.removeItem(LOCALSTORAGE_USERNAME_KEY);
    this.setOwnUsername(this.defaultUsername);
    this.activeRoom.nameHandler.setUsernameInput(this.defaultUsername);
  }
  resetUsernameInput() {
    this.activeRoom.nameHandler.setUsernameInput();
  }
  setOwnUsername(username, isInitial) {
    this.ownUsername = username;
    localStorage.setItem(LOCALSTORAGE_USERNAME_KEY, username);
    if (!isInitial) {
      this.activeRoom.nameHandler.changeUsername(CURRENT_USER_ID, username);
      sendMessage('changeName', username, this.activeRoom.roomCode);
    }
  }

  // ---- Room handling ----
  addNewRoom(roomCode, peers, activate) {
    if (!this.ownUsername) {
      throw new Error('@ addNewRoom: No default username has been set');
    }

    const newRoom = new ScratchetRoom(roomCode, this.ownUsername, peers);

    newRoom.roomListNode.addEventListener('click', this.roomListNodeClick.bind(this, newRoom));
    roomList.appendChild(newRoom.roomListNode);

    this.rooms.set(roomCode, newRoom);
    this.updateRoomIndicator();
    if (activate) {
      this.switchActiveRoom(newRoom);
    }
  }

  switchActiveRoom(room) {
    if (this.activeRoom) {
      this.activeRoom.unfocus();
    }
    this.activeRoom = room;

    room.focus();

    room.nameHandler.setUsernameInput();
    room.nameHandler.appendUserList();
    room.nameHandler.updateUserIndicator();

    copyRoomLinkContent.textContent = room.roomCodeLink;

    hueSlider.value = room.hue;
    widthSlider.value = room.width;
  }

  updateRoomIndicator() {
    roomListButton.textContent = this.rooms.size;
  }

  // ---- Canvas handling ----
  highlightUser(userID) {
    this.activeRoom.redrawCanvas(this.activeRoom.posUserCache.get(userID));
  }

  addToPosBuffer(posX, posY) {
    this.posBufferClient.push(posX, posY);
    this.posBufferServer.push(posX, posY);
  }

  initializePosBufferNormal(lastPosX, lastPosY) {
    const hue = this.activeRoom.hue;
    const width = this.activeRoom.width;
    let flag = 0;

    this.posBufferServer = new Array(2);

    if (!this.willSendCompleteMetaData && getClientMetaHue(this.posBufferClient) === hue) {
      flag |= 0b0010;
    } else {
      this.lastHue = hue;
      this.posBufferServer.push(this.lastHue);
    }
    if (!this.willSendCompleteMetaData && getClientMetaWidth(this.posBufferClient) === width) {
      flag |= 0b0001;
    } else {
      this.lastWidth = width;
      this.posBufferServer.push(this.lastWidth);
    }

    this.posBufferServer.push(lastPosX, lastPosY);
    this.posBufferServer[0] = this.activeRoom.roomCode;
    this.posBufferServer[1] = flag;

    this.posBufferClient = [hue, width, lastPosX, lastPosY, flag];
  }
  initializePosBufferErase() {
    this.posBufferServer = [this.activeRoom.roomCode, MODE.ERASE, this.activeRoom.width];
    this.posBufferClient = [];
  }

  // TODO this can probably be made less redundant
  resetPosBuffer() {
    if (getPendingServerMetaMode(this.posBufferServer) === MODE.ERASE) {
      this.initializePosBufferErase();
    } else {
      this.initializePosBufferNormal(
        this.posBufferClient[this.posBufferClient.length - 2],
        this.posBufferClient[this.posBufferClient.length - 1],
      );
    }
  }
  // Only update width and hue
  updatePosBuffer() {
    if (getPendingServerMetaMode(this.posBufferServer) === MODE.ERASE) {
      this.initializePosBufferErase();
    } else if (this.posBufferClient.length > 0) {
      this.initializePosBufferNormal(
        this.posBufferClient[2],
        this.posBufferClient[3],
      );
    }
  }

  sendCompleteMetaDataNextTime() {
    this.willSendCompleteMetaData = true;
  }

  // ---- Socket handling ----
  sendPositions() {
    const mode = getPendingServerMetaMode(this.posBufferServer);

    if (mode === MODE.ERASE && this.posBufferServer.length > (META_LEN.ERASE + EXTRA_SERVER_META_LEN)
        || this.posBufferClient.length > META_LEN.NORMAL) {
      const posData = new Int16Array(this.posBufferServer);
      sock.send(posData.buffer);
      if (this.posBufferClient.length > 0) {
        this.activeRoom.addClientDataToBuffer(new Int16Array(this.posBufferClient), CURRENT_USER_ID);
        // posBufferServer needs to be checked due to asynchronities
        // between willSendCompleteMetaData and sendPositions
        // And to ensure that it only resets on normal mode
        if (this.willSendCompleteMetaData && mode === 0) {
          this.willSendCompleteMetaData = false;
        }
      }
      this.resetPosBuffer();
    } else {
      this.updatePosBuffer();
    }
  }

  // Overrule timer if hue or stroke width has changed
  sendPositionsIfWidthHasChanged() {
    if (this.activeRoom.width !== getClientMetaWidth(this.posBufferClient)) {
      this.sendPositions();
    }
  }
  sendPositionsIfHueHasChanged() {
    if (this.activeRoom.hue !== getClientMetaHue(this.posBufferClient)) {
      this.sendPositions();
    }
  }

  parseSocketData(data) {
    const mode = getReceivedServerMetaMode(data);
    const userID = data[0];
    const roomCode = data[1];
    data = data.subarray(2);

    const targetRoom = this.rooms.get(roomCode);

    switch (mode) {
      case MODE.BULK_INIT:
        targetRoom.handleBulkInitData(data, userID);
        break;
      case MODE.ERASE:
        targetRoom.handleEraseData(data, userID);
        break;
      default:
        targetRoom.addServerDataToBuffer(data, userID);
    }
  }

  // ---- Socket message events ----
  userDisconnect(userID) {
    for (const roomCode of this.rooms.keys()) {
      // TODO Better notification handling:
      // - "{user of current room} has disconnected"
      // - "{user} has left room {room}"
      this.userLeave(userID, roomCode);
    }
  }
  userLeave(userID, roomCode) {
    const room = this.rooms.get(roomCode);
    if (room) {
      const username = room.nameHandler.removeUserFromUserList(userID);

      room.removeUser(userID);

      dispatchNotification(`${username} has left the room`);
    }
  }
  userJoin(userID, roomCode, username) {
    const room = this.rooms.get(roomCode);
    if (room) {
      room.addUser(userID, username);

      dispatchNotification(`${username} has entered the room`);
    }
  }
  userClearData(userID) {
    this.activeRoom.clearUserBufferAndRedraw(userID);
  }
  userChangeName(userID, newUsername) {
    const prevUsername = this.activeRoom.nameHandler.getUsername(userID);
    const username = this.activeRoom.nameHandler.changeUsername(userID, newUsername);

    dispatchNotification(`${prevUsername} --> ${username}`);
  }

  ownUserGetJoinData(value) {
    // For async reasons, the real user ID is solely used for the username
    this.defaultUsername = value.defaultName;
    this.setOwnUsername(value.name, true);
    this.addNewRoom(value.room, value.peers, true);

    // NOTE: Needs to be called after `addNewRoom` for the room link content size
    if (!this.isInitialized) {
      this.init();
    }
  }

  // ---- Socket events ----
  socketOpen() {
    console.info('connected!');

    const initValue = {};
    if (this.ownUsername) {
      initValue.name = this.ownUsername;
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
        case 'disconnect':
          this.userDisconnect(data.usr);
          break;
        case 'leave': {
          this.userLeave(data.usr, data.room);
          break;
        }
        case 'join': {
          this.userJoin(data.usr, data.room, data.val);
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
        case 'joinData': {
          this.ownUserGetJoinData(data.val);
          break;
        }
      }
    }
  }
}
