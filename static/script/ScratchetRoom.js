class ScratchetRoom extends ScratchetCanvas {
  nameHandler;
  roomListNode;
  roomCodeLink;
  roomName;

  constructor(canvas, roomCode, ownUsername, peers) {
    super(canvas);

    this.nameHandler = new UsernameHandler(usernameInput, userList, userListButton, ownUsername, peers);
    this.roomListNode = ScratchetRoom.createRoomListNode();
    this.roomCodeLink = ScratchetRoom.createRoomCodeLink(roomCode);
    this.changeRoomName(ScratchetRoom.createDefaultName(ownUsername));
  }

  // ---- Generic room handling ----
  changeRoomName(roomName) {
    this.roomName = roomName;
    this.roomListNode.textContent = roomName;
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
}
