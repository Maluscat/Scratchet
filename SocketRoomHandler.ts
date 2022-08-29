import type { SocketUser, SocketID, RoomCode, RoomName, Username } from './SocketUser.ts';
import { SocketRoom } from './SocketRoom.ts';
import { ScratchetError } from './ScratchetError.ts';
import Validator from './static/script/Validator.mjs';

export class SocketRoomHandler {
  readonly #activeRooms: Map<RoomCode, SocketRoom> = new Map();

  // ---- Utility functions ----
  getRoomOrCreateNewRoom(initialUser: SocketUser, initialUsername?: Username, roomCode?: RoomCode) {
    if (this.hasRoom(roomCode)) {
      return this.getRoom(roomCode!);
    } else {
      return this.createNewRoom(initialUser, initialUsername);
    }
  }

  createNewRoom(initialUser: SocketUser, initialUsername?: Username) {
    const roomCode = this.createNewRoomCode();
    const roomName = initialUser.getUsernameFromValidation(initialUsername) + "'s room";

    const room = new SocketRoom(roomCode, roomName);
    this.addRoom(roomCode, room);
    return room;
  }

  getRoomWithUserExistanceCheck(socketUser: SocketUser, roomCode?: RoomCode) {
    if (!this.hasRoom(roomCode)) {
      throw new ScratchetError(`Room with roomCode #${roomCode} does not exist!`);
    }

    const socketRoom = this.getRoom(roomCode);
    if (!socketRoom.getUsers().has(socketUser)) {
      throw new ScratchetError(`User is not in ${socketRoom}!`);
    }

    return socketRoom;
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
