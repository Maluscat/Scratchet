import type { SocketID, RoomCode } from './SocketUser.ts';
import { SocketRoom } from './SocketRoom.ts';
import Validator from './static/script/Validator.mjs';

export class SocketRoomHandler {
  readonly #activeRooms: Map<RoomCode, SocketRoom> = new Map();

  getRoomOrCreateNewRoom(roomCode?: RoomCode) {
    if (this.hasRoom(roomCode)) {
      return this.getRoom(roomCode!);
    } else {
      return this.createNewRoom();
    }
  }

  createNewRoom() {
    const roomCode = this.createNewRoomCode();
    const room = new SocketRoom(roomCode);
    this.addRoom(roomCode, room);
    return room;
  }

  // ---- Map wrappers ----
  addRoom(roomCode: RoomCode, room: SocketRoom) {
    this.#activeRooms.set(roomCode, room);
  }

  hasRoom(roomCode?: RoomCode) {
    if (Validator.validateRoomCode(roomCode)) {
      return this.#activeRooms.has(roomCode!);
    }
    return false;
  }

  getRoom(roomCode: RoomCode) {
    return this.#activeRooms.get(roomCode)!;
  }

  deleteRoom(roomCode: RoomCode) {
    this.#activeRooms.delete(roomCode);
  }

  getAllRooms() {
    return this.#activeRooms.values();
  }

  // ---- Helper functions ----
  createNewRoomCode() {
    let roomCode: RoomCode;
    do {
      // Generate random number of interval [1000, 9999]
      roomCode = Math.floor(Math.random() * 9000 + 1000);
    } while (this.#activeRooms.has(roomCode));
    return roomCode;
  }
}
