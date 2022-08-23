class ScratchetRoom extends ScratchetCanvas {
  static canvasZIndex = 1;

  nameHandler;
  roomListNode;
  roomCodeLink;

  roomCode;
  roomName;

  constructor(roomCode, roomName, globalUsername, peers) {
    super(ScratchetRoom.createCanvas());

    this.roomCode = roomCode;

    this.addUserToUserCache(CURRENT_USER_ID);
    for (const [ userID ] of peers) {
      this.addUserToUserCache(userID);
    }

    this.nameHandler = new UsernameHandler(globalUsername, peers);
    this.roomListNode = ScratchetRoom.createRoomListNode();
    this.roomCodeLink = ScratchetRoom.createRoomCodeLink(roomCode);

    this.changeRoomName(roomName);
  }

  // ---- Generic user handling ----
  addUser(userID, username) {
    this.addUserToUserCache(userID);
    this.nameHandler.addUserToUserList(userID, username);
    this.sendJoinedUserBuffer();
  }
  removeUser(userID) {
    this.clearUserBufferAndRedraw(userID);
    this.posUserCache.delete(userID);
    return this.nameHandler.removeUserFromUserList(userID);
  }

  addUserToUserCache(userID) {
    this.posUserCache.set(userID, new Set());
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

  // ---- Helper functions ----
  setRoomNameInput() {
    roomNameInput.textContent = this.roomName;
  }

  // ---- Static helper functions ----
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
