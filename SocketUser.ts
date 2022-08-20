import type { SocketRoom } from './SocketRoom.ts';
import Validator from './static/script/Validator.mjs';

export type SocketID = number;
export type RoomCode = number;
export type Username = string;

export class SocketUser {
  static socketIDCounter: SocketID = 0;

  sock: WebSocket;
  id: SocketID;
  name: Username;
  defaultName: Username;
  isActive = false;

  // #rooms: Set<SocketRoom>;

  constructor(sock: WebSocket) {
    this.sock = sock;
    this.id = SocketUser.socketIDCounter++;
    this.defaultName = SocketUser.createDefaultName(this.id);
    this.name = this.defaultName;
  }
  
  init(username?: Username) {
    if (username) {
      this.setName(username);
    }

    // this.#rooms = new Set();
    this.isActive = true;

    return this;
  }

  // ---- Room handling ----
  // NEEDED?
  // addToRoom(socketRoom: SocketRoom) {
  //   this.#rooms.add(socketRoom);
  // }
  // removeFromRoom(socketRoom: SocketRoom) {
  //   this.#rooms.delete(socketRoom);
  // }
  // getRooms() {
  //   return this.#rooms;
  // }

  // ---- WebSocket handling ----
  send(data: string | ArrayBuffer) {
    if (this.sock.readyState === 1) {
      if (!this.isActive) {
        throw new Error(`${this} tried to send while inactive!`);
      }
      this.sock.send(data);
    }
  }

  sendInitialJoinData(socketRoom: SocketRoom) {
    // NOTE: `defaultName` is sent on every new join request redundantly
    // for simplicity purposes
    const data = JSON.stringify({
      evt: 'joinData',
      val: {
        room: socketRoom.roomCode,
        name: this.name,
        defaultName: this.defaultName,
        peers: this.getTransmittablePeerArray(socketRoom)
      }
    });
    this.send(data);
  }

  // ---- ArrayBuffer handling ----
  prependIDToBuffer(dataArr: Int16Array): ArrayBuffer {
    const newData = new Int16Array(dataArr.length + 1);
    newData.set(dataArr, 1);
    newData[0] = this.id;
    return newData.buffer;
  }

  // ---- Helper functions ----
  setName(newUsername: Username) {
    if (Validator.validateUsername(newUsername)) {
      this.name = newUsername;
    }
  }

  getTransmittablePeerArray(socketRoom: SocketRoom) {
    const peerArr = new Array();
    for (const socketUser of socketRoom.getUsers()) {
      if (socketUser !== this) {
        peerArr.push([ socketUser.id, socketUser.name ]);
      }
    }
    return peerArr;
  }

  toString() {
    return `SocketUser #${this.id} (${this.isActive ? 'active' : 'inactive'}, username: ${this.name})`;
  }

  // ---- Static helper functions ----
  // TODO this can be taken from UsernameHandler
  static createDefaultName(userID: SocketID): Username {
    return 'User #' + userID;
  }
}
