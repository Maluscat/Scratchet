class ScratchetRoom extends ScratchetCanvas {
  roomListNode;
  roomCodeLink;
  romName;

  constructor(canvas, roomCode, ownUsername) {
    super(canvas);

    this.roomListNode = ScratchetRoom.createRoomListNode();
    this.roomCodeLink = ScratchetRoom.createRoomCodeLink(roomCode);
    this.roomName = ScratchetRoom.createDefaultName(ownUsername);

    this.changeRoomName(this.roomName);
  }

  // ---- Generic room handling ----
  changeRoomName(roomName) {
    this.roomName = roomName;
    this.roomListNode.textContent = roomName;
    if (controller.activeRoom === this) {
      roomcodeInput.textContent = roomName;
    }
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
