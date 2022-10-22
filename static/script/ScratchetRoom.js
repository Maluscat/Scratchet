'use strict';
/**
 * @typedef { import('./init.js') }
 * @typedef { import('./ScratchetCanvas.js') }
 * @typedef { import('./UsernameHandler.js') }
 * @typedef { import('./ScratchetUser.js') }
 */

class ScratchetRoom extends ScratchetCanvas {
  static canvasZIndex = 1;

  nameHandler;
  roomListNode;
  roomCodeLink;

  roomCode;
  roomName;

  /** @type { Map<number, ScratchetUser> } */
  users = new Map();
  userListNode;

  constructor(roomCode, roomName, globalUsername, peers) {
    super(ScratchetRoom.createCanvas());

    this.roomCode = roomCode;

    this.userListNode = ScratchetRoom.createEmptyUserList();
    this.roomListNode = ScratchetRoom.createRoomListNode();
    this.roomCodeLink = ScratchetRoom.createRoomCodeLink(roomCode);

    this.addUser(CURRENT_USER_ID, globalUsername)
    for (const [ userID, username ] of peers) {
      this.addUser(userID, username);
    }

    this.changeRoomName(roomName);
  }

  // ---- User handling ----
  /** @return { ScratchetUser } */
  getOwnUser() {
    return this.users.get(CURRENT_USER_ID);
  }
  /**
   * @param { number } userID
   * @return { ScratchetUser }
   */
  getUser(userID) {
    return this.users.get(userID);
  }
  /**
   * @param { number } userID
   * @return { boolean }
   */
  hasUser(userID) {
    return this.users.has(userID);
  }

  addUser(userID, username) {
    const user = new ScratchetUser(username, userID);

    this.users.set(userID, user);
    this.addUserToUserCache(userID);

    this.userListNode.appendChild(user.listNode);
    this.updateUserIndicator();

    this.sendJoinedUserBuffer();
  }
  removeUser(userID) {
    if (!this.hasUser(userID)) {
      return ScratchetUser.createUnknownDefaultName(userID);
    }
    const user = this.getUser(userID);
    this.users.delete(userID);

    this.clearUserBufferAndRedraw(userID);
    this.posUserCache.delete(userID);

    this.userListNode.removeChild(user.listNode);
    this.updateUserIndicator();

    return user;
  }

  addUserToUserCache(userID) {
    this.posUserCache.set(userID, new Set());
  }

  changeUsername(userID, newUsername) {
    if (!this.hasUser(userID)) {
      this.addUser(userID, newUsername);
    }
    this.getUser(userID).setName(newUsername);
    return newUsername;
  }

  // ---- User UI helpers ----
  setUsernameInput() {
    usernameInput.textContent = this.getOwnUser().name;
  }

  updateUserIndicator() {
    userListButton.textContent = this.users.size;
  }
  appendUserList() {
    if (userListWrapper.childElementCount > 0) {
      userListWrapper.firstElementChild.remove();
    }
    userListWrapper.appendChild(this.userListNode);
    this.updateUserIndicator();
  }

  // ---- Generic room handling ----
  changeRoomName(roomName) {
    if (roomName !== this.roomName) {
      this.roomName = roomName;
      this.roomListNode.textContent = roomName;
      this.setRoomNameInput();
    }
  }

  focus() {
    controls3D.changeState(this.state);
    controls3D.changeEventTarget(this.canvas);

    this.canvas.classList.remove('inactive');
    this.roomListNode.classList.add('current');

    this.setRoomNameInput();
    // NOTE z-index is not strictly necessary, but might prove handy for future styling
    // Remove if room switch styling is complete and z-index is not needed
    this.canvas.style.zIndex = ScratchetRoom.canvasZIndex++;
  }
  unfocus() {
    this.canvas.classList.add('inactive');
    this.roomListNode.classList.remove('current');
  }

  // ---- Room UI helpers ----
  setRoomNameInput() {
    roomNameInput.textContent = this.roomName;
  }

  // ---- Static helper functions ----
  static createEmptyUserList() {
    const userList = document.createElement('ul');
    userList.classList.add('user-list');
    return userList;
  }

  static createRoomListNode() {
    const listNode = document.createElement('span');
    listNode.classList.add('item');
    return listNode;
  }

  static createRoomCodeLink(roomCode) {
    return `${location.href}#${roomCode}`;
  }

  static createCanvas() {
    const canvas = document.createElement('canvas');
    canvasContainer.appendChild(canvas);
    return canvas;
  }
}
