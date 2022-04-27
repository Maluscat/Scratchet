class ScratchetRoom extends ScratchetCanvas {
  roomListNode = ScratchetRoom.createRoomListNode();
  roomName;

  constructor(canvas, roomCode, ownUsername) {
    super(canvas);
    this.initRoom(roomCode, ownUsername);
  }

  // ---- Event handling ----
  roomListNodeClick() {
    console.log(this.roomName);
  }

  // ---- Generic room handling ----
  initRoom(roomCode, ownUsername) {
    this.changeRoomName(ScratchetRoom.createDefaultName(ownUsername));
    this.roomListNode.addEventListener('click', this.roomListNodeClick.bind(this));
    roomList.appendChild(this.roomListNode);
  }

  changeRoomName(roomName) {
    this.roomName = roomName;
    this.roomListNode.textContent = roomName;
    roomcodeInput.textContent = roomName;
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
}
