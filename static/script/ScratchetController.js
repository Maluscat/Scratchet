class ScratchetController {
  canvas;

  rooms = new Set();
  activeRoom;

  constructor(canvas) {
    this.canvas = canvas;
  }

  init() {
    hueSlider.addEvent('change:value', () => activeRoom.setStrokeStyle());
    widthSlider.addEvent('change:value', () => activeRoom.setLineWidth());
    document.getElementById('clear-button').addEventListener('click', activeRoom.clearCurrentUserCanvas.bind(activeRoom));

    setInterval(sendPositions, SEND_INTERVAL);
  }

  addNewRoom(roomCode, ownUsername, activate) {
    const newRoom = new ScratchetRoom(this.canvas, roomCode, ownUsername);
    this.rooms.add(newRoom);
    this.updateRoomIndicator();
    if (activate) {
      this.switchActiveRoom(newRoom);
    }
  }

  switchActiveRoom(room) {
    activeRoom = room;
  }

  updateRoomIndicator() {
    roomListButton.textContent = this.rooms.size;
  }
}
