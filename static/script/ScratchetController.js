'use strict';
class ScratchetController extends ScratchetBufferController {
  globalUsername;
  defaultUsername;

  /** @type { Map<number, ScratchetRoom> } */
  rooms = new Map();
  activeIntervals = new Array();

  constructor() {
    super();
    // Binding functions to themselves to be able to remove them from events
    this.pointerUp = this.pointerUp.bind(this);
    this.mouseWheel = this.mouseWheel.bind(this);
    this.windowResized = this.windowResized.bind(this);

    const persistentUsername = localStorage.getItem(LOCALSTORAGE_USERNAME_KEY);
    if (persistentUsername) {
      this.globalUsername = persistentUsername;
    }
  }

  init() {
    // These are events that need to access initialized properties like `activeRoom`
    hueSlider.addEvent('change:value', this.changeHue.bind(this));
    widthSlider.addEvent('change:value', this.changeWidth.bind(this));

    ui.registerInputHandler(
      usernameInput,
      this.changeOwnUsername.bind(this),
      Global.Validator.MAX_USERNAME_LENGTH,
      Global.Validator.validateUsername);

    ui.registerInputHandler(
      roomNameInput,
      this.changeCurrentRoomName.bind(this),
      Global.Validator.MAX_ROOM_NAME_LENGTH,
      Global.Validator.validateRoomName);

    clearDrawingButton.addEventListener('click', this.clearDrawing.bind(this));
    copyRoomLinkButton.addEventListener('click', this.copyRoomLink.bind(this));
    newRoomButton.addEventListener('click', this.requestNewRoom.bind(this));
    leaveRoomButton.addEventListener('click', this.leaveCurrentRoom.bind(this));

    // Set the join room input to the same width as the copy room link overlay
    copyRoomLinkOverlay.classList.add('active');
    joinRoomOverlayInput.style.maxWidth =
      (copyRoomLinkContent.offsetWidth / parseFloat(getComputedStyle(copyRoomLinkContent).fontSize)) + 'em';
    copyRoomLinkOverlay.classList.remove('active');
  }

  activate() {
    ui.activateUI();

    window.addEventListener('pointerup', this.pointerUp);
    window.addEventListener('wheel', this.mouseWheel, { passive: false });
    window.addEventListener('resize', this.windowResized);

    this.activeIntervals.add(
      setInterval(this.sendPositions.bind(this), Global.SEND_INTERVAL));
    this.activeIntervals.add(
      setInterval(this.sendCompleteMetaDataNextTime.bind(this), SEND_FULL_METADATA_INTERVAL));
  }

  deactivate() {
    for (const intervalID of this.activeIntervals) {
      clearInterval(intervalID);
    }
    this.activeIntervals.clear();

    window.removeEventListener('pointerup', this.pointerUp);
    window.removeEventListener('wheel', this.mouseWheel);
    window.removeEventListener('resize', this.windowResized);

    ui.deactivateUI();

    this.activeRoom = null;
    roomNameInput.textContent = '';
    ui.setUserIndicator(0);
  }

  // ---- Event handling ----
  pointerUp() {
    this.sendPositions();
    this.activeRoom.finalizeDraw();
  }

  windowResized() {
    for (const room of this.rooms.values()) {
      room.setDimensions();
      room.setTransform();
    }
  }

  mouseWheel(e) {
    if (e.deltaY !== 0) {
      const direction = -1 * (e.deltaY / Math.abs(e.deltaY)); // either 1 or -1
      if (e.shiftKey) {
        widthSlider.value += direction * 7;
      } else if (e.ctrlKey) {
        e.preventDefault();
        hueSlider.value += direction * 24;
      }
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
  leaveCurrentRoom() {
    sendMessage('leave', null, this.activeRoom.roomCode);
    this.removeRoom(this.activeRoom);
  }

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
    if (this.activeRoom != null) {
      this.activeRoom.setUsernameInput();
    } else {
      usernameInput.textContent = this.globalUsername;
    }
  }
  setOwnUsername(username, isInitial) {
    if (isInitial || this.activeRoom == null || username !== this.activeRoom.getOwnUser().name) {
      this.globalUsername = username;
      localStorage.setItem(LOCALSTORAGE_USERNAME_KEY, username);
      if (!isInitial && this.activeRoom != null) {
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
    document.body.classList.remove('initial-load');

    newRoom.roomListNode.addEventListener('click', this.roomListNodeClick.bind(this, newRoom));
    roomList.appendChild(newRoom.roomListNode);

    this.rooms.set(roomCode, newRoom);
    this.updateRoomIndicator();
    if (activate) {
      this.switchActiveRoom(newRoom);
    }
  }
  removeRoom(room) {
    this.rooms.delete(room.roomCode);
    room.removeSelf();
    if (this.rooms.size > 0) {
      // Switch to the first room
      this.switchActiveRoom(this.rooms.values().next().value);
    } else {
      this.deactivate();
    }
    this.updateRoomIndicator();
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
    ui.setRoomIndicator(this.rooms.size);
  }

  // ---- Canvas helpers ----
  highlightUser(user) {
    this.activeRoom.redrawCanvas(user);
  }

  // ---- Socket receive handling ----
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
    const isDeactivated = !this.activeRoom;

    // For async reasons, the real user ID is solely used for the username
    this.defaultUsername = value.defaultName;
    this.setOwnUsername(value.username, true);
    this.addNewRoom(value.roomCode, value.roomName, value.peers, true);

    // NOTE: Needs to be called after `addNewRoom` to wait for the room activation
    if (isDeactivated) {
      this.activate();
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
