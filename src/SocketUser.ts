import type { SocketRoom, MessageData } from 'SocketRoom';
import type { Request } from 'oak';

import { SocketRateHandler } from 'SocketRateHandler';
import { ServerSocketBase } from 'ServerSocketBase';
import { ScratchetError } from 'ScratchetError';
import { validateUsername } from 'Validator';
import { USER_DEACTIVATION_TIMEOUT } from 'Meta';

export type SocketID = number;
export type RoomCode = number;
export type RoomName = string;
export type Username = string;

export class SocketUser {
  static socketIDCounter: SocketID = 0;

  readonly ip: string;
  readonly id: SocketID;
  #defaultName: Username;
  sock: ServerSocketBase;
  rate: SocketRateHandler; 
  isActive = false;

  #deactivationTimeoutID: null | number = null;
  #rooms: Map<SocketRoom, Username>;

  constructor(sock: ServerSocketBase, request: Request) {
    this.sock = sock;
    this.id = SocketUser.socketIDCounter++;
    this.ip = request.ip;
    this.#defaultName = SocketUser.createDefaultName(this.id);
    this.rate = new SocketRateHandler();
    this.#rooms = new Map();
  }
  
  // ---- Activation ----
  deactivate(callback?: (user: SocketUser) => void) {
    if (callback) {
      this.#deactivationTimeoutID = setTimeout(() => {
        callback(this);
      }, USER_DEACTIVATION_TIMEOUT);
    }
    this.isActive = false;
  }
  activate() {
    this.isActive = true;
    if (this.#deactivationTimeoutID != null) {
      clearTimeout(this.#deactivationTimeoutID);
      this.#deactivationTimeoutID = null;
    }
  }

  /**
   * Merge a given user into this one,
   * regardless of any conditions (e.g. whether their origins match).
   *
   * @privateRemarks
   * When introducing new properties, keep an eye on their
   * mergability and expand this method if necessary.
   */
  merge(sourceUser: SocketUser) {
    this.rate.increment(sourceUser.rate.getCount());
    this.#defaultName = sourceUser.#defaultName;
  }

  /**
   * Validate whether it is safe to assume that a given request is of the
   * same origin as the one the user was created at.
   *
   * For now, checking only the IP will suffice. The user can still switch
   * users within the local NAT but hey, go ahead and hack the app to switch
   * your cheetah drawings with your brother's I guess.
   */
  validateOriginEquality(user: SocketUser) {
    return user.ip === this.ip;
  }

  // ---- Room handling ----
  addToRoom(socketRoom: SocketRoom, username?: Username) {
    username = this.getUsernameFromValidation(username);
    this.#rooms.set(socketRoom, username);
  }
  removeFromRoom(socketRoom: SocketRoom) {
    this.#rooms.delete(socketRoom);
  }
  getRooms() {
    return this.#rooms.keys();
  }

  getNameForRoom(socketRoom: SocketRoom): Username {
    // NOTE The entry is assumed to exist and not asserted!
    return this.#rooms.get(socketRoom)!;
  }
  setNameForRoom(socketRoom: SocketRoom, newUsername: string) {
    newUsername = this.getUsernameFromValidation(newUsername);
    this.#rooms.set(socketRoom, newUsername);
  }

  getPeers() {
    const peers = new Set<SocketUser>();
    for (const rooms of this.getRooms()) {
      for (const user of rooms.getUsers()) {
        if (user !== this) {
          peers.add(user);
        }
      }
    }
    return peers;
  }

  // ---- WebSocket handling ----
  broadcastJSONToAllPeers(event: string, value?: string) {
    const dataObj: MessageData = {
      evt: event,
      usr: this.id
    };
    if (value != null) {
      dataObj.val = value;
    }
    const data = JSON.stringify(dataObj);
    for (const user of this.getPeers()) {
      user.send(data);
    }
  }

  send(data: string | ArrayBuffer) {
    if (this.sock.socket.readyState === 1) {
      if (!this.isActive) {
        throw new ScratchetError(`Tried to send while inactive (data: ${data})`);
      }
      this.sock.socket.send(data);
    }
  }

  sendInitialJoinData(socketRoom: SocketRoom) {
    // NOTE: `defaultName` is sent on every new join request redundantly
    // for simplicity purposes
    const data = JSON.stringify({
      evt: 'joinData',
      val: {
        userID: this.id,
        roomCode: socketRoom.roomCode,
        roomName: socketRoom.roomName,
        username: this.getNameForRoom(socketRoom),
        defaultName: this.#defaultName,
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
  getUsernameFromValidation(username?: Username): Username {
    if (validateUsername(username)) {
      return username!;
    }
    return this.#defaultName;
  }

  getTransmittablePeerArray(socketRoom: SocketRoom) {
    const peerArr = new Array();
    for (const socketUser of socketRoom.getUsers()) {
      if (socketUser !== this) {
        const username = socketUser.getNameForRoom(socketRoom);
        peerArr.push([ socketUser.id, username ]);
      }
    }
    return peerArr;
  }

  toString() {
    return `SocketUser #${this.id} (${this.isActive ? 'active' : 'inactive'})`;
  }

  // ---- Static helper functions ----
  // TODO this can be taken from UsernameHandler
  static createDefaultName(userID: SocketID): Username {
    return 'User #' + userID;
  }
}
