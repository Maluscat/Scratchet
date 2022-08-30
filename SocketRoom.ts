import type { SocketID, RoomCode, RoomName, Username } from './SocketUser.ts';
import { SocketUser } from './SocketUser.ts';
import { roomHandler } from './main.ts';
import { ScratchetError } from './ScratchetError.ts';
import Validator from './static/script/Validator.mjs';

export interface ConnectionData {
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
  userBulkInitQueue: Map<SocketUser, WeakSet<SocketUser>> = new Map();

  constructor(roomCode: RoomCode, roomName: Username) {
    this.roomCode = roomCode;
    this.roomName = roomName;
  }
  
  // ---- User handling ----
  addUser(socketUser: SocketUser, username?: Username) {
    this.#sockets.add(socketUser);

    socketUser.addToRoom(this, username);
    // This is done to enfore correct validation (which happens in addToRoom)
    username = socketUser.getNameForRoom(this);

    this.addUserToBulkInitQueue(socketUser);
    this.sendJSONToUsers(socketUser, 'join', username);

    socketUser.sendInitialJoinData(this);
  }
  removeUser(socketUser: SocketUser) {
    this.removeUserFromBulkInitQueue(socketUser);

    this.#sockets.delete(socketUser);
    if (this.#sockets.size === 0) {
      // Delete self
      roomHandler.deleteRoom(this.roomCode);
      socketUser.removeFromRoom(this);
    }
  } 
  getUsers() {
    return this.#sockets;
  }

  // ---- Init Queue & initial data ----
  addUserToBulkInitQueue(socketUser: SocketUser) {
    if (this.getUsers().size > 0) {
      this.userBulkInitQueue.set(socketUser, new WeakSet([socketUser]));

      setTimeout(() => {
        this.removeUserFromBulkInitQueue(socketUser);
      }, SocketRoom.INIT_QUEUE_TIMEOUT);
    }
  }
  removeUserFromBulkInitQueue(socketUser: SocketUser) {
    this.userBulkInitQueue.delete(socketUser);
  }

  /**
   * Go through the bulk init queue until finding a user which hasn't
   * been sent the data to yet.
   *
   * @param {SocketUser} socketUser The user which sends the bulk init data.
   * @param {ArrayBuffer} newBuffer The buffer to send, with the socketUser ID prepended.
   */
  sendBulkInitData(socketUser: SocketUser, newBuffer: ArrayBuffer) {
    for (const [ servedUser, handledUsers ] of this.userBulkInitQueue) {
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
    if (Validator.validateRoomName(newRoomName)) {
      this.roomName = newRoomName;
    }
  }

  toString() {
    return `Room #${this.roomCode} (name: ${this.roomName}, users: ${this.getUsers()})`;
  }
}
