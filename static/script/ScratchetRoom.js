class ScratchetRoom extends ScratchetCanvas {
  static canvasZIndex = 1;

  nameHandler;
  roomListNode;
  roomCodeLink;

  roomCode;
  roomName;

  constructor(roomCode, ownUsername, peers) {
    super(ScratchetRoom.createCanvas());

    this.roomCode = roomCode;

    this.addUserToUserCache(CURRENT_USER_ID);
    for (const [ userID ] of peers) {
      this.addUserToUserCache(userID);
    }

    this.nameHandler = new UsernameHandler(ownUsername, peers);
    this.roomListNode = ScratchetRoom.createRoomListNode();
    this.roomCodeLink = ScratchetRoom.createRoomCodeLink(roomCode);
    this.changeRoomName(ScratchetRoom.createDefaultName(ownUsername));
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
  }

  addUserToUserCache(userID) {
    this.posUserCache.set(userID, new Set());
  }

  // ---- Generic room handling ----
  changeRoomName(roomName) {
    this.roomName = roomName;
    this.roomListNode.textContent = roomName;
  }

  focusCanvas() {
    this.canvas.classList.remove('inactive');
    // NOTE z-index is not strictly necessary, but might prove handy for future styling
    // Remove if room switch styling is complete and z-index is not needed
    this.canvas.style.zIndex = ScratchetRoom.canvasZIndex++;
  }
  unfocusCanvas() {
    this.canvas.classList.add('inactive');
  }

  // ---- Static helper functions ----
  static createRoomListNode() {
    const listNode = document.createElement('span');
    listNode.classList.add('item');
    return listNode;
  }

  static createDefaultName(username) {
    return username + "'s room";
  }

  static createRoomCodeLink(roomCode) {
    return `${location.href}#${roomCode}`;
  }

  static createCanvas() {
    const canvas = document.createElement('canvas');
    canvasContainer.appendChild(canvas);
    return canvas;
  }

  static validateValueToRoomCode(value) {
    if (!JOINROOM_VALIDATE_REGEX.test(value)) {
      return false;
    }
    return parseInt(value.match(JOINROOM_VALIDATE_REGEX)[1]);
  }
}
