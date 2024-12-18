import type { SocketID, RoomCode, RoomName, Username } from 'SocketUser';

import { SocketUser } from 'SocketUser';
import { ScratchetError } from 'ScratchetError';
import { validateRoomName } from 'Validator';
import { controller } from 'main';

export interface ConnectionData {
  existingUser?: number;
  roomCode?: RoomCode;
  username?: Username;
}

export interface MessageData {
  [key: string]: any;

  evt: string;
  usr?: SocketID;
  room?: RoomCode;
  val?: string | ConnectionData;
}

export class SocketRoom {
  static INIT_QUEUE_TIMEOUT = 1000 * 10;

  readonly #sockets: Set<SocketUser> = new Set();
  readonly roomCode: RoomCode;
  roomName: RoomName;

  // TODO: is this necessary? One can circumvent this by just sending a huge normal send
  /**
   * A queue which tracks which users of this room have already received
   * bulk init data from a user.
   * Form: Map<RecentlyJoinedUser, Set<UserWhichHasSentDataToJoinedUser>>
   */
  #userBulkInitQueue: Map<SocketUser, WeakSet<SocketUser>> = new Map();
  /** Saves the autoremoval timeouts of the bulk init queue. */
  #bulkInitTimeouts: WeakMap<SocketUser, number> = new WeakMap;

  constructor(roomCode: RoomCode, roomName: Username) {
    this.roomCode = roomCode;
    this.roomName = roomName;
  }
  
  // ---- User handling ----
  addUser(socketUser: SocketUser, username?: Username) {
    if (!this.#sockets.has(socketUser)) {
      this.#sockets.add(socketUser);

      socketUser.addToRoom(this, username);
      // This is done to enfore correct validation (which happens in addToRoom)
      username = socketUser.getNameForRoom(this);

      this.addUserToBulkInitQueue(socketUser);
      this.sendJSONToUsers(socketUser, 'connect', username);

      socketUser.sendInitialJoinData(this);
    }
  }
  removeUser(socketUser: SocketUser) {
    this.removeUserFromBulkInitQueue(socketUser);

    this.#sockets.delete(socketUser);
    if (this.#sockets.size === 0) {
      // Delete self
      controller.roomHandler.deleteRoom(this.roomCode);
      socketUser.removeFromRoom(this);
    }
  } 
  getUsers() {
    return this.#sockets;
  }
  *getActiveUsers() {
    for (const sock of this.getUsers()) {
      if (sock.isActive) {
        yield sock;
      }
    }
  }

  // ---- Init Queue & initial data ----
  addUserToBulkInitQueue(socketUser: SocketUser) {
    if (this.getUsers().size > 0) {
      if (this.#userBulkInitQueue.has(socketUser)) {
        clearTimeout(this.#bulkInitTimeouts.get(socketUser));
      }
      this.#userBulkInitQueue.set(socketUser, new WeakSet([socketUser]));

      const timeoutID = setTimeout(() => {
        this.removeUserFromBulkInitQueue(socketUser);
      }, SocketRoom.INIT_QUEUE_TIMEOUT);
      this.#bulkInitTimeouts.set(socketUser, timeoutID);
    }
  }
  removeUserFromBulkInitQueue(socketUser: SocketUser) {
    this.#userBulkInitQueue.delete(socketUser);
    this.#bulkInitTimeouts.delete(socketUser);
  }

  /**
   * Go through the bulk init queue until finding a user which hasn't
   * been sent the data to yet.
   * The rate limitation will limit how many users can join and receive
   * init data at once, but without a limitation here the system could
   * be exploited easily.
   *
   * @param {SocketUser} socketUser The user which sends the bulk init data.
   * @param {ArrayBuffer} newBuffer The buffer to send, with the socketUser ID prepended.
   */
  sendBulkInitData(socketUser: SocketUser, newBuffer: ArrayBuffer) {
    for (const [ servedUser, handledUsers ] of this.#userBulkInitQueue) {
      if (!handledUsers.has(socketUser)) {
        servedUser.send(newBuffer);
        handledUsers.add(socketUser);
        return;
      }
    }
    throw new ScratchetError(`Is not in bulk init queue but tried to send bulk init data to ${this}`);
  }

  // ---- Socket functions ----
  sendJSONToUsers(callingUser: SocketUser, event: string, value?: string) {
    const dataObj: MessageData = {
      evt: event,
      usr: callingUser.id,
      room: this.roomCode
    };
    if (value != null) {
      dataObj.val = value;
    }
    const data = JSON.stringify(dataObj);

    this.sendAnyDataToUsers(callingUser, data);
  }

  sendAnyDataToUsers(callingUser: SocketUser, data: string | ArrayBuffer) {
    for (const user of this.getUsers()) {
      if (user != callingUser) {
        user.send(data);
      }
    }
  }

  // ---- Helper functions ----
  setName(newRoomName: RoomName) {
    if (validateRoomName(newRoomName)) {
      this.roomName = newRoomName;
    }
  }

  toString() {
    return `\
Room #${this.roomCode} (name: ${this.roomName}, users: [
    ${Array.from(this.getUsers()).join('\n    ')}
  ])`;
  }
}
