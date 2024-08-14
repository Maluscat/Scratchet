import * as Meta from '~/constants/meta.js';
import * as Validator from '~/constants/Validator.js';
import {
  LOCALSTORAGE_USERNAME_KEY,
  roomList,
  usernameInput,
  roomNameInput,
  copyRoomLinkContent,
  copyRoomLinkOverlay,
  joinRoomOverlayInput,
} from '~/constants/misc.js';
import { Room } from '~/room/Room.js';
import { ui } from '~/init.js';

/** @typedef { import('@lib/socket-handler/script/ClientSocketBase.js').ClientSocketBase } ClientSocketBase */

export class Controller {
  globalUsername;
  defaultUsername;

  sock;
  /** @type number */
  userID;

  /** @type { Map<number, Room> } */
  rooms = new Map();

  /** @type { Room } */
  activeRoom;

  /** @param { ClientSocketBase } sock */
  constructor(sock) {
    // Binding functions to themselves to be able to remove them from events
    this.pointerUp = this.pointerUp.bind(this);
    this.windowResized = this.windowResized.bind(this);
    this.handleURLHashChange = this.handleURLHashChange.bind(this);
    this.scaleCanvasAtCenter = this.scaleCanvasAtCenter.bind(this);

    this.invokeUndo = this.invokeUndo.bind(this);
    this.invokeRedo = this.invokeRedo.bind(this);
    this.clearDrawing = this.clearDrawing.bind(this);
    this.copyRoomLink = this.copyRoomLink.bind(this);
    this.requestNewRoom = this.requestNewRoom.bind(this);
    this.leaveCurrentRoom = this.leaveCurrentRoom.bind(this);
    this.toolButtonClick = this.toolButtonClick.bind(this);

    this.socketOpen = this.socketOpen.bind(this);
    this.socketTimeout = this.socketTimeout.bind(this);
    this.socketReconnect = this.socketReconnect.bind(this);
    this.socketReceiveMessage = this.socketReceiveMessage.bind(this);

    this.sock = sock;
    this.sock.addEventListener('open', this.socketOpen);
    this.sock.addEventListener('message', this.socketReceiveMessage);
    this.sock.addEventListener('_timeout', this.socketTimeout);
    this.sock.addEventListener('_reconnect', this.socketReconnect);

    const persistentUsername = localStorage.getItem(LOCALSTORAGE_USERNAME_KEY);
    if (persistentUsername) {
      this.globalUsername = persistentUsername;
    }
  }

  init() {
    this.sock.initializeConnection();

    ui.registerInputHandler(
      usernameInput,
      this.changeOwnUsername.bind(this),
      Validator.MAX_USERNAME_LENGTH,
      Validator.validateUsername);

    ui.registerInputHandler(
      roomNameInput,
      this.changeCurrentRoomName.bind(this),
      Validator.MAX_ROOM_NAME_LENGTH,
      Validator.validateRoomName);

    const validatorRegexStr = Validator.JOINROOM_VALIDATE_REGEX.toString();
    joinRoomOverlayInput.pattern = validatorRegexStr.slice(1, validatorRegexStr.lastIndexOf('/'));

    // Set the join room input to the same width as the copy room link overlay, with a dummy value
    copyRoomLinkContent.textContent = Room.createRoomCodeLink('0000');
    copyRoomLinkOverlay.classList.add('active');
    joinRoomOverlayInput.style.maxWidth =
      (copyRoomLinkContent.offsetWidth / parseFloat(getComputedStyle(copyRoomLinkContent).fontSize)) + 'em';
    copyRoomLinkOverlay.classList.remove('active');
    copyRoomLinkContent.textContent = '';

    window.addEventListener('hashchange', this.handleURLHashChange);
  }

  activate() {
    if (this.activeRoom) {
      this.activeRoom.setRoomNameInput();
      this.activeRoom.updateUserIndicator();
    }

    ui.activateUI();

    window.addEventListener('pointerup', this.pointerUp);
    window.addEventListener('resize', this.windowResized);
  }

  deactivate() {
    window.removeEventListener('pointerup', this.pointerUp);
    window.removeEventListener('resize', this.windowResized);

    ui.deactivateUI();

    roomNameInput.textContent = '';
    ui.setUserIndicator(0);
  }

  // ---- Event handling ----
  pointerUp() {
    this.activeRoom.finalizeOwnDraw();
  }

  windowResized() {
    for (const room of this.rooms.values()) {
      room.view.setDimensions();
      room.view.setTransform();
    }
  }

  scaleCanvasAtCenter(scaleAmount) {
    this.activeRoom.view.setTransformWithNewState({
      scale: { x: scaleAmount, y: scaleAmount }
    }, null, true);
  }

  toolButtonClick(toolName) {
    this.activeRoom.activateTool(toolName);
  }

  clearDrawing() {
    this.activeRoom.clearUserBufferAndRedraw(this.activeRoom.ownUser);
    this.sock.sendEvent('clearUser', { room: this.activeRoom.roomCode });
  }

  // -> Room overlay
  leaveCurrentRoom() {
    this.sock.sendEvent('leave', { room: this.activeRoom.roomCode });
    this.removeRoom(this.activeRoom);
  }

  requestNewRoom() {
    this.sock.sendEvent('newRoom', {
      val: {
        username: this.globalUsername
      }
    });
  }

  joinRoomFromInput(roomInputValue) {
    const roomCode = Validator.validateRoomInputValueToRoomCode(roomInputValue);
    if (roomCode) {
      this.joinRoom(roomCode);
      ui.collapseJoinRoomOverlay();
    }
    return !!roomCode;
  }
  joinRoom(roomCode) {
    if (!this.rooms.has(roomCode)) {
      this.sock.sendEvent('joinRoom', {
        val: {
          roomCode: roomCode,
          username: this.globalUsername
        }
      });
    }
  }

  async copyRoomLink() {
    if (!navigator.clipboard) {
      copyRoomLinkOverlay.classList.toggle('active');
      return;
    }

    await navigator.clipboard.writeText(this.activeRoom.roomCodeLink);

    if (window.matchMedia('(hover: hover)').matches) {
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
    if (Validator.validateRoomName(newRoomName)) {
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
    } else if (Validator.validateUsername(newUsername)) {
      this.setOwnUsername(newUsername);
    } else {
      this.resetUsernameInput();
    }
  }

  // -> Utility overlay
  invokeUndo() {
    this.activeRoom.ownUndo();
  }
  invokeRedo() {
    this.activeRoom.ownRedo();
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
    if (isInitial || this.activeRoom == null || username !== this.activeRoom.ownUser.name) {
      this.globalUsername = username;
      localStorage.setItem(LOCALSTORAGE_USERNAME_KEY, username);
      if (!isInitial && this.activeRoom != null) {
        this.activeRoom.ownUser.setName(username);
        this.sock.sendEvent('changeName', { val: username, room: this.activeRoom.roomCode });
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
      this.sock.sendEvent('changeRoomName', { val: newRoomName, room: this.activeRoom.roomCode })
    }
  }

  // ---- Room handling ----
  addNewRoom(roomCode, roomName, peers, activate) {
    if (!this.globalUsername) {
      throw new Error('@ addNewRoom: No global persistent username has been set');
    }

    const newRoom = new Room(roomCode, roomName, this.globalUsername, peers);
    document.body.classList.remove('initial-load');

    newRoom.roomListNode.addEventListener('click', this.roomListNodeClick.bind(this, newRoom));
    roomList.appendChild(newRoom.roomListNode);

    this.sock.addEventListener('_receivedPing', newRoom.handleReceivedPing);

    this.rooms.set(roomCode, newRoom);
    this.updateRoomIndicator();
    if (activate) {
      this.switchActiveRoom(newRoom);
    }
  }
  /** @param { Room } room */
  async removeRoom(room) {
    this.#deleteRoom(room);

    /** @type Room */
    let firstRoom;
    if (this.rooms.size > 0) {
      firstRoom = this.rooms.values().next().value;
      firstRoom.displayCanvas();
    } else {
      this.activeRoom = null;
      this.deactivate();
    }

    await room.removeSelf();

    if (firstRoom) {
      this.switchActiveRoom(firstRoom);
    }
    this.updateRoomIndicator();
  }
  /**
   * Remove all rooms without any animations and without cleanup.
   * The active room is not cleared and the controller is not deactivated.
   */
  removeAllRoomsImmediatelyDirty() {
    for (const room of this.rooms.values()) {
      this.#deleteRoom(room);
      room.removeSelfWithoutAnimation();
    }
    this.updateRoomIndicator();
  }
  /** @param { Room } room */
  #deleteRoom(room) {
    this.rooms.delete(room.roomCode);
    this.sock.removeEventListener('_receivedPing', room.handleReceivedPing);
  }

  /** @param { number } userID */
  getRoomsOfUser(userID) {
    return Array.from(this.rooms.values())
      .filter(room => room.hasUser(userID));
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
  }

  updateRoomIndicator() {
    ui.setRoomIndicator(this.rooms.size);
  }

  // ---- Canvas helpers ----
  highlightUser(user) {
    this.activeRoom.view.update(user);
  }

  // ---- Socket receive handling ----
  parseSocketData(data) {
    const mode = Meta.getReceivedServerMode(data);
    const userID = data[0];
    const roomCode = data[1];
    data = data.subarray(2);

    const targetRoom = /** @type Room */ (this.rooms.get(roomCode));
    // TODO Perhaps integrate this check & error into `getUser` directly
    if (!targetRoom.hasUser(userID)) {
      throw new Error(`@ parseSocketData: User #${userID} does not exist`);
    }
    const targetUser = targetRoom.getUser(userID);

    switch (mode) {
      case Meta.MODE.BULK_INIT:
        targetRoom.handleBulkInitData(data, targetUser);
        break;
      case Meta.MODE.ERASE:
        targetRoom.handleEraseData(data, targetUser);
        break;
      case Meta.MODE.UNDO:
        targetRoom.undo(targetUser, data[1]);
        break;
      case Meta.MODE.REDO:
        targetRoom.redo(targetUser, data[1]);
        break;
      case Meta.MODE.HISTORY_MARKER:
        targetRoom.addHistoryGroup(targetUser);
        break;
      default:
        targetRoom.addServerDataToBufferAndDraw(data, targetUser);
    }
  }

  // ---- Socket message events ----
  // NOTE: Received data is considered validated
  userDisconnect(userID) {
    this.dispatchNotifInActiveRoom(userID, user => `${user.name} has disconnected`);

    for (const room of this.getRoomsOfUser(userID)) {
      room.removeUser(userID);
    }
  }
  userLeave(userID, roomCode) {
    this.dispatchNotifInActiveRoom(userID, user => `${user.name} has left the room`);

    const room = this.rooms.get(roomCode);
    room.removeUser(userID);
  }
  userConnect(userID, roomCode, username) {
    const room = this.rooms.get(roomCode);
    room.addUser(userID, username);

    this.dispatchNotifInActiveRoom(userID, user => `${user.name} has entered the room`);
  }
  userTimeout(userID) {
    for (const room of this.getRoomsOfUser(userID)) {
      room.handleUserTimeout(userID);
    }
    this.dispatchNotifInActiveRoom(userID, user => `${user.name} has timed out`);
  }
  userReconnect(userID) {
    for (const room of this.getRoomsOfUser(userID)) {
      room.handleUserReconnect(userID);
    }
    this.dispatchNotifInActiveRoom(userID, user => `${user.name} has reconnected`);
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

    this.dispatchNotifInActiveRoom(userID, _ => `User: ${prevUsername} --> ${newUsername}`);
  }
  userChangeRoomName(roomCode, newRoomName) {
    const room = this.rooms.get(roomCode);
    const prevRoomName = room.roomName;
    room.changeRoomName(newRoomName);

    if (room === this.activeRoom) {
      ui.dispatchNotification(`Room: ${prevRoomName} --> ${newRoomName}`);
    }
  }

  ownUserGetJoinData(value) {
    const isDeactivated = !this.activeRoom;

    if (!isDeactivated && value.initial) {
      this.removeAllRoomsImmediatelyDirty();
    }

    // For async reasons, the real user ID is only used for the username and syncing
    this.userID = value.userID;
    this.defaultUsername = value.defaultName;
    this.setOwnUsername(value.username, true);
    this.addNewRoom(value.roomCode, value.roomName, value.peers, true);

    if (isDeactivated) {
      this.activate();
    }
  }


  // ---- Socket events ----
  socketReconnect() {
    this.activate();
  }
  socketTimeout() {
    this.deactivate();
  }

  socketOpen() {
    console.info('connected!');

    const initValue = {};

    const potentialRoomCode = this.getAndRemovePotentialURLRoomCode();
    if (potentialRoomCode) {
      initValue.roomCode = potentialRoomCode;
    }
    if (this.globalUsername) {
      initValue.username = this.globalUsername;
    }
    if (this.userID != null) {
      initValue.existingUser = this.userID;
    }

    this.sock.sendEvent('connectInit', { val: initValue });
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
        case 'connect': {
          this.userConnect(data.usr, data.room, data.val);
          break;
        }
        case 'timeout': {
          this.userTimeout(data.usr);
          break;
        }
        case 'reconnect': {
          this.userReconnect(data.usr);
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

  // ---- Notification helpers ----
  /**
   * Dispatches a UI notification only if the specified userID
   * is in the currently active room.
   * @param { number } userID
   * @param { (user: UserBulkInit) => string } messageCallback
   */
  dispatchNotifInActiveRoom(userID, messageCallback) {
    if (this.activeRoom.hasUser(userID)) {
      const user = this.activeRoom.getUser(userID);
      ui.dispatchNotification(messageCallback(user));
    }
  }

  // ---- URL helpers ----
  handleURLHashChange(e) {
    const roomCode = this.getAndRemovePotentialURLRoomCode();
    if (roomCode) {
      this.joinRoom(roomCode);
    }
  }

  getAndRemovePotentialURLRoomCode() {
    const rawURLHash = location.hash.slice(1);
    const roomCode = Validator.validateAndReturnRoomCode(rawURLHash);
    if (rawURLHash !== '') {
      window.history.replaceState(false, '', location.pathname);
    }
    return roomCode;
  }
}
