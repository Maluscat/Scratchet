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
import { sock, ui } from '~/init.js';

export class Controller {
  globalUsername;
  defaultUsername;

  /** @type { Map<number, Room> } */
  rooms = new Map();

  /** @type { Room } */
  activeRoom;

  constructor() {
    // Binding functions to themselves to be able to remove them from events
    this.pointerUp = this.pointerUp.bind(this);
    this.mouseWheel = this.mouseWheel.bind(this);
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

    const persistentUsername = localStorage.getItem(LOCALSTORAGE_USERNAME_KEY);
    if (persistentUsername) {
      this.globalUsername = persistentUsername;
    }
  }

  init() {
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
    ui.activateUI();

    window.addEventListener('pointerup', this.pointerUp);
    window.addEventListener('wheel', this.mouseWheel, { passive: false });
    window.addEventListener('resize', this.windowResized);
  }

  deactivate() {
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

  mouseWheel(e) {
    if (e.deltaY !== 0) {
      const direction = -1 * (e.deltaY / Math.abs(e.deltaY)); // either 1 or -1
      this.activeRoom.scrollAction(e, direction);
    }
  }

  toolButtonClick(toolName) {
    this.activeRoom.activateTool(toolName);
  }

  clearDrawing() {
    this.activeRoom.clearUserBufferAndRedraw(this.activeRoom.ownUser);
    sock.sendEvent('clearUser', { room: this.activeRoom.roomCode });
  }

  // -> Room overlay
  leaveCurrentRoom() {
    sock.sendEvent('leave', { room: this.activeRoom.roomCode });
    this.removeRoom(this.activeRoom);
  }

  requestNewRoom() {
    sock.sendEvent('newRoom', {
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
      sock.sendEvent('joinRoom', {
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
        sock.sendEvent('changeName', { val: username, room: this.activeRoom.roomCode });
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
      sock.sendEvent('changeRoomName', { val: newRoomName, room: this.activeRoom.roomCode })
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

    this.rooms.set(roomCode, newRoom);
    this.updateRoomIndicator();
    if (activate) {
      this.switchActiveRoom(newRoom);
    }
  }
  async removeRoom(room) {
    this.rooms.delete(room.roomCode);

    /** @type {Room} */
    let firstRoom;
    if (this.rooms.size > 0) {
      firstRoom = this.rooms.values().next().value;
      firstRoom.displayCanvas();
    } else {
      this.deactivate();
    }

    ui.blockCanvasInOutAnimation();
    await room.removeSelf();

    if (firstRoom) {
      this.switchActiveRoom(firstRoom);
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

    const targetRoom = this.rooms.get(roomCode);
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

    if (isDeactivated) {
      this.activate();
    }
  }

  // ---- Socket events ----
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

    sock.sendEvent('connectInit', { val: initValue });
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
