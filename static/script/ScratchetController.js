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

  // ---- Room handling ----
  addNewRoom(roomCode, ownUsername, activate) {
    const newRoom = new ScratchetRoom(this.canvas, roomCode, ownUsername);
    this.rooms.add(newRoom);
    this.updateRoomIndicator();
    if (activate) {
      this.switchActiveRoom(newRoom);
    }
  }

  switchActiveRoom(room) {
    this.activeRoom = room;
  }

  updateRoomIndicator() {
    roomListButton.textContent = this.rooms.size;
  }
}
