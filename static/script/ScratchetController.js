'use strict';
class ScratchetController {
  globalUsername;
  defaultUsername;

  /**
   * @type { Map<number, ScratchetRoom> }
   */
  rooms = new Map();
  /**
   * @type { ScratchetRoom }
   */
  activeRoom;

  sendBufferServer = new Array();
  sendBufferClient = new Array();
  willSendCompleteMetaData = true;

  constructor() {
    const persistentUsername = localStorage.getItem(LOCALSTORAGE_USERNAME_KEY);
    if (persistentUsername) {
      this.globalUsername = persistentUsername;
    }
  }

  init() {
    // These are events that need to access initialized properties like `activeRoom`
    hueSlider.addEvent('change:value', this.changeHue.bind(this));
    widthSlider.addEvent('change:value', this.changeWidth.bind(this));

    usernameInput.addEventListener('input', e => {
      ui.handleOverlayInputChange(e, Global.Validator.validateUsername);
    });
    usernameInput.addEventListener('beforeinput', e => {
      ui.handleOverlayInputBeforeChange(e, Global.Validator.MAX_USERNAME_LENGTH);
    });
    usernameInput.addEventListener('blur', e => {
      ui.handleOverlayInputSubmit(e, this.changeOwnUsername.bind(this));
    });

    roomNameInput.addEventListener('input', e => {
      ui.handleOverlayInputChange(e, Global.Validator.validateRoomName);
    });
    roomNameInput.addEventListener('beforeinput', e => {
      ui.handleOverlayInputBeforeChange(e, Global.Validator.MAX_ROOM_NAME_LENGTH);
    });
    roomNameInput.addEventListener('blur', e => {
      ui.handleOverlayInputSubmit(e, this.changeCurrentRoomName.bind(this));
    });

    clearDrawingButton.addEventListener('click', this.clearDrawing.bind(this));
    copyRoomLinkButton.addEventListener('click', this.copyRoomLink.bind(this));
    newRoomButton.addEventListener('click', this.requestNewRoom.bind(this));

    // Set the join room input to the same width as the copy room link overlay
    copyRoomLinkOverlay.classList.add('active');
    joinRoomOverlayInput.style.maxWidth =
      (copyRoomLinkContent.offsetWidth / parseFloat(getComputedStyle(copyRoomLinkContent).fontSize)) + 'em';
    copyRoomLinkOverlay.classList.remove('active');

    setInterval(this.sendPositions.bind(this), Global.SEND_INTERVAL);
    setInterval(this.sendCompleteMetaDataNextTime.bind(this), SEND_FULL_METADATA_INTERVAL);
  }

  // ---- Event handling ----
  windowResized() {
    for (const room of this.rooms.values()) {
      room.setDimensions();
      room.setTransform();
    }
  }

  // -> Utility overlay
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
    this.activeRoom.clearUserBufferAndRedraw(this.activeRoom.getOwnUser());
    this.sendCompleteMetaDataNextTime();
    sendMessage('clearUser', null, this.activeRoom.roomCode);
  }

  // -> Room overlay
  requestNewRoom() {
    sendMessage('newRoom', { username: this.globalUsername });
  }

  joinRoom(roomInputValue) {
    const roomCode = Global.Validator.validateRoomInputValueToRoomCode(roomInputValue);
    if (roomCode && !this.rooms.has(roomCode)) {
      sendMessage('joinRoom', {
        roomCode: roomCode,
        username: this.globalUsername
      });
      ui.collapseJoinRoomOverlay();
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
    newRoomName = newRoomName.trim();
    if (Global.Validator.validateRoomName(newRoomName)) {
      this.setCurrentRoomName(newRoomName);
    } else {
      this.resetRoomNameInput();
    }
  }

  roomListNodeClick(room) {
    this.switchActiveRoom(room);
  }

  // -> Social overlay
  changeOwnUsername(newUsername) {
    newUsername = newUsername.trim();
    if (newUsername === '') {
      this.resetUsernameToDefault();
    } else if (Global.Validator.validateUsername(newUsername)) {
      this.setOwnUsername(newUsername);
    } else {
      this.resetUsernameInput();
    }
  }

  // ---- Username handling ----
  resetUsernameToDefault() {
    this.setOwnUsername(this.defaultUsername);
    this.resetUsernameInput();
  }
  resetUsernameInput() {
    usernameInput.classList.remove('invalid');
    this.activeRoom.setUsernameInput();
  }
  setOwnUsername(username, isInitial) {
    if (isInitial || username !== this.activeRoom.getOwnUser().name) {
      this.globalUsername = username;
      localStorage.setItem(LOCALSTORAGE_USERNAME_KEY, username);
      if (!isInitial) {
        this.activeRoom.getOwnUser().setName(username);
        sendMessage('changeName', username, this.activeRoom.roomCode);
      }
    }
  }

  // ---- Room name handling ----
  resetRoomNameInput() {
    roomNameInput.classList.remove('invalid');
    this.activeRoom.setRoomNameInput();
  }
  setCurrentRoomName(newRoomName) {
    if (newRoomName !== this.activeRoom.roomName) {
      this.activeRoom.changeRoomName(newRoomName);
      sendMessage('changeRoomName', newRoomName, this.activeRoom.roomCode);
    }
  }

  // ---- Room handling ----
  addNewRoom(roomCode, roomName, peers, activate) {
    if (!this.globalUsername) {
      throw new Error('@ addNewRoom: No global persistent username has been set');
    }

    const newRoom = new ScratchetRoom(roomCode, roomName, this.globalUsername, peers);

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

    room.setUsernameInput();
    room.appendUserList();

    copyRoomLinkContent.textContent = room.roomCodeLink;

    hueSlider.value = room.hue;
    widthSlider.value = room.width;
  }

  updateRoomIndicator() {
    roomListButton.textContent = this.rooms.size;
  }

  // ---- Canvas handling ----
  highlightUser(user) {
    this.activeRoom.redrawCanvas(user);
  }

  addToSendBuffer(posX, posY) {
    this.sendBufferClient.push(posX, posY);
    this.sendBufferServer.push(posX, posY);
  }

  initializeSendBufferNormal(lastPosX, lastPosY) {
    const hue = this.activeRoom.hue;
    const width = this.activeRoom.width;
    let flag = 0;

    this.sendBufferServer = new Array(2);

    if (!this.willSendCompleteMetaData && getClientMetaHue(this.sendBufferClient) === hue) {
      flag |= 0b0010;
    } else {
      this.lastHue = hue;
      this.sendBufferServer.push(this.lastHue);
    }
    if (!this.willSendCompleteMetaData && getClientMetaWidth(this.sendBufferClient) === width) {
      flag |= 0b0001;
    } else {
      this.lastWidth = width;
      this.sendBufferServer.push(this.lastWidth);
    }

    this.sendBufferServer.push(lastPosX, lastPosY);
    this.sendBufferServer[0] = this.activeRoom.roomCode;
    this.sendBufferServer[1] = flag;

    this.sendBufferClient = [hue, width, lastPosX, lastPosY, flag];
  }
  initializeSendBufferErase() {
    this.sendBufferServer = [this.activeRoom.roomCode, Global.MODE.ERASE, this.activeRoom.width];
    this.sendBufferClient = [];
  }

  // TODO this can probably be made less redundant
  resetSendBuffer() {
    if (getPendingServerMetaMode(this.sendBufferServer) === Global.MODE.ERASE) {
      this.initializeSendBufferErase();
    } else {
      this.initializeSendBufferNormal(
        this.sendBufferClient[this.sendBufferClient.length - 2],
        this.sendBufferClient[this.sendBufferClient.length - 1],
      );
    }
  }
  // Only update width and hue
  updateSendBuffer() {
    if (getPendingServerMetaMode(this.sendBufferServer) === Global.MODE.ERASE) {
      this.initializeSendBufferErase();
    } else if (this.sendBufferClient.length > 0) {
      this.initializeSendBufferNormal(
        this.sendBufferClient[2],
        this.sendBufferClient[3],
      );
    }
  }

  sendCompleteMetaDataNextTime() {
    this.willSendCompleteMetaData = true;
  }

  // ---- Socket handling ----
  sendPositions() {
    const mode = getPendingServerMetaMode(this.sendBufferServer);

    if (mode === Global.MODE.ERASE && this.sendBufferServer.length > (META_LEN.ERASE + EXTRA_SERVER_META_LEN)
        || this.sendBufferClient.length > META_LEN.NORMAL) {
      const posData = new Int16Array(this.sendBufferServer);
      sock.send(posData.buffer);
      if (this.sendBufferClient.length > 0) {
        this.activeRoom.addClientDataToBuffer(
          new Int16Array(this.sendBufferClient), this.activeRoom.getOwnUser());
        // posBufferServer needs to be checked due to asynchronities
        // between willSendCompleteMetaData and sendPositions
        // And to ensure that it only resets on normal mode
        if (this.willSendCompleteMetaData && mode === 0) {
          this.willSendCompleteMetaData = false;
        }
      }
      this.resetSendBuffer();
    } else {
      this.updateSendBuffer();
    }
  }

  // Overrule timer if hue or stroke width has changed
  sendPositionsIfWidthHasChanged() {
    if (this.activeRoom.width !== getClientMetaWidth(this.sendBufferClient)) {
      this.sendPositions();
    }
  }
  sendPositionsIfHueHasChanged() {
    if (this.activeRoom.hue !== getClientMetaHue(this.sendBufferClient)) {
      this.sendPositions();
    }
  }

  parseSocketData(data) {
    const mode = getReceivedServerMetaMode(data);
    const userID = data[0];
    const roomCode = data[1];
    data = data.subarray(2);

    const targetRoom = this.rooms.get(roomCode);
    // TODO Perhaps integrate this check & error into `getUser` directly
    if (!targetRoom.hasUser(userID)) {
      throw new Error(`@ parseSocketData: User #${userID} does not exist`);
    }
    const targetUser = targetRoom.getUser(userID);

    switch (mode) {
      case Global.MODE.BULK_INIT:
        targetRoom.handleBulkInitData(data, targetUser);
        break;
      case Global.MODE.ERASE:
        targetRoom.handleEraseData(data, targetUser);
        break;
      default:
        targetRoom.addServerDataToBufferAndDraw(data, targetUser);
    }
  }

  // ---- Socket message events ----
  // NOTE: Received data is considered validated
  userDisconnect(userID) {
    const activeUsername = this.activeRoom.hasUser(userID) && this.activeRoom.getUser(userID).name;
    for (const room of this.rooms.values()) {
      if (room.hasUser(userID)) {
        room.removeUser(userID);
      }
    }
    if (activeUsername) {
      ui.dispatchNotification(`${activeUsername} has disconnected`);
    }
  }
  // TODO utilize the room name: "{user} has left/entered (current?) room {room name}"
  userLeave(userID, roomCode) {
    const room = this.rooms.get(roomCode);
    const username = room.removeUser(userID).name;

    ui.dispatchNotification(`${username} has left the room`);
  }
  userJoin(userID, roomCode, username) {
    const room = this.rooms.get(roomCode);
    room.addUser(userID, username);

    ui.dispatchNotification(`${username} has entered the room`);
  }
  userClearData(userID, roomCode) {
    const user = this.rooms.get(roomCode).getUser(userID);
    this.activeRoom.clearUserBufferAndRedraw(user);
  }
  userChangeUserName(userID, roomCode, newUsername) {
    const room = this.rooms.get(roomCode);
    const user = room.getUser(userID);
    const prevUsername = user.name;
    user.setName(newUsername);

    ui.dispatchNotification(`User: ${prevUsername} --> ${newUsername}`);
  }
  userChangeRoomName(roomCode, newRoomName) {
    const room = this.rooms.get(roomCode);
    const prevRoomName = room.roomName;
    room.changeRoomName(newRoomName);

    ui.dispatchNotification(`Room: ${prevRoomName} --> ${newRoomName}`);
  }

  ownUserGetJoinData(value) {
    const isInitial = !this.activeRoom;

    // For async reasons, the real user ID is solely used for the username
    this.defaultUsername = value.defaultName;
    this.setOwnUsername(value.username, true);
    this.addNewRoom(value.roomCode, value.roomName, value.peers, true);

    // NOTE: Needs to be called after `addNewRoom` to wait for the room activation
    if (isInitial) {
      this.init();
    }
  }

  // ---- Socket events ----
  socketOpen() {
    console.info('connected!');

    const initValue = {};
    if (this.globalUsername) {
      initValue.username = this.globalUsername;
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
        case 'leave': {
          this.userLeave(data.usr, data.room);
          break;
        }
        case 'join': {
          this.userJoin(data.usr, data.room, data.val);
          break;
        }
        case 'clearUser': {
          this.userClearData(data.usr, data.room);
          break;
        }
        case 'changeName': {
          this.userChangeUserName(data.usr, data.room, data.val);
          break;
        }
        case 'changeRoomName': {
          this.userChangeRoomName(data.room, data.val);
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
