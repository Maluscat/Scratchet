class ScratchetController {
  canvas;

  rooms = new Set();
  activeRoom;

  constructor(canvas) {
    this.canvas = canvas;
  }

  init() {
    hueSlider.addEvent('change:value', () => this.activeRoom.setStrokeStyle());
    widthSlider.addEvent('change:value', () => this.activeRoom.setLineWidth());
    document.getElementById('clear-button').addEventListener('click', this.activeRoom.clearCurrentUserCanvas.bind(this.activeRoom));

    setInterval(sendPositions, SEND_INTERVAL);
  }

  // ---- Event handling ----
  roomListNodeClick(room) {
    switchActiveRoom(room);
  }

  // ---- Room handling ----
  addNewRoom(roomCode, ownUsername, activate) {
    const newRoom = new ScratchetRoom(this.canvas, roomCode, ownUsername);

    newRoom.roomListNode.addEventListener('click', this.roomListNodeClick.bind(this, newRoom));
    roomList.appendChild(newRoom.roomListNode);

    this.rooms.add(newRoom);
    this.updateRoomIndicator();
    if (activate) {
      this.switchActiveRoom(newRoom);
    }
  }

  switchActiveRoom(room) {
    this.activeRoom = room;
    copyRoomLinkOverlay.textContent = room.roomCodeLink;
  }

  updateRoomIndicator() {
    roomListButton.textContent = this.rooms.size;
  }
}
