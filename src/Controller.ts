import type { SocketRoom, ConnectionData, MessageData } from 'SocketRoom';
import type { Request } from 'oak';
import { receivedEventsInterface } from 'main';

import { SocketUser } from 'SocketUser';
import { ScratchetError } from 'ScratchetError';
import { ServerSocketBase } from 'ServerSocketBase';
import { SocketRoomHandler } from 'SocketRoomHandler';
import * as Meta from 'Meta';

export class Controller {
  readonly roomHandler = new SocketRoomHandler();
  readonly usersByID = new Map<number, SocketUser>();
  readonly users = new WeakMap<ServerSocketBase, SocketUser>();

  constructor() {
    this.destroyUser = this.destroyUser.bind(this);
  }

  registerSocket(sock: ServerSocketBase, request: Request) {
    // We create a new user up front. It might not actually be needed.
    sock.addEventListener('open', this.createUser.bind(this, sock, request));
    sock.addEventListener('close', this.socketClose.bind(this, sock));
    sock.addEventListener('message', (e: MessageEvent) => {
      this.receiveMessage(this.users.get(sock)!, e);
    });
    sock.addEventListener('_timeout', () => {
      if (this.users.has(sock)) {
        this.handleTimeout(this.users.get(sock));
      }
    });
  }

  socketClose(sock: ServerSocketBase) {
    this.users.get(sock)?.deactivate(this.destroyUser);
  }

  handleTimeout(socketUser: SocketUser) {
    socketUser.broadcastJSONToAllPeers('timeout');
    socketUser.deactivate();
  }
  handleReconnect(socketUser: SocketUser) {
    if (!socketUser.isActive) {
      socketUser.activate();
      for (const room of socketUser.getRooms()) {
        room.addUserToBulkInitQueue(socketUser);
      }
      socketUser.broadcastJSONToAllPeers('reconnect');
    }
  }

  receiveMessage(socketUser: SocketUser, e: MessageEvent) {
    try {
      socketUser.rate.increment();
      if (socketUser.rate.isLimited) {
        throw new ScratchetError(`Rate limitation reached: ${socketUser.rate.getCount()}`);
      }

      if (e.data instanceof ArrayBuffer) {
        if (!socketUser.isActive) {
          throw new ScratchetError(`${socketUser} tried to send a buffer while inactive.`);
        }

        const dataArr = new Int16Array(e.data);
        const roomCode = dataArr[0];
        const socketRoom = this.roomHandler.getRoomWithUserExistanceCheck(socketUser, roomCode);
        const newBuffer = socketUser.prependIDToBuffer(dataArr);

        if (dataArr[1] === Meta.MODE.BULK_INIT) {
          socketRoom.sendBulkInitData(socketUser, newBuffer);
        } else {
          // Pass data on
          socketRoom.sendAnyDataToUsers(socketUser, newBuffer);
        }
      } else if (typeof e.data === 'string') {
        this.handleReceivedEvent(socketUser, JSON.parse(e.data));
      } else {
        throw new ScratchetError(`Received an unknown socket response: ${JSON.stringify(e.data)}`);
      }
    } catch (e) {
      if (e instanceof ScratchetError) {
        console.warn(`Warning (${e.date.toLocaleString()})! ${socketUser}: ` + e.message);
      } else {
        throw e;
      }
    }
  }

  // ---- Event handling ----
  handleReceivedEvent(socketUser: SocketUser, data: MessageData) {
    if (!data) {
      throw new ScratchetError(`Couldn't parse socket event: No data supplied`);
    }

    if (!Object.hasOwn(receivedEventsInterface, data.evt)) {
      throw new ScratchetError(`Unrecognized event: ${JSON.stringify(data)}`);
    }
    const eventInterface = receivedEventsInterface[data.evt];

    if (!eventInterface.init && !socketUser.isActive) {
      throw new ScratchetError(`${socketUser} tried to send '${data.evt}' event while inactive.`);
    }

    // Check if all required fields are present and are of their required types
    for (const [requiredField, requiredType] of Object.entries(eventInterface.required)) {
      if (!Object.hasOwn(data, requiredField)) {
        throw new ScratchetError(`Event omitted required field '${requiredField}': ${JSON.stringify(data)}`);
      }
      if ((typeof data[requiredField]) !== requiredType) {
        throw new ScratchetError(`Event field '${requiredField}' is not of type '${requiredType}': ${JSON.stringify(data)}`);
      }
    }

    let socketRoom: SocketRoom;
    if ('room' in data) {
      socketRoom = this.roomHandler.getRoomWithUserExistanceCheck(socketUser, data.room);
    }

    if ('fn' in eventInterface) {
      eventInterface.fn!(socketUser, data.val, socketRoom);
    }

    // NOTE: objects are excluded here, val may only be a string right now
    if (eventInterface.passOn && typeof data.val !== 'object' && socketRoom != null) {
      socketRoom.sendJSONToUsers(socketUser, data.evt, data.val);
    }
  }


  // ---- Message event response ----
  initializeUserConnection(socketUser: SocketUser, properties: ConnectionData) {
    // NOTE `properties` is guaranteed to be an object, but it could have no properties
    const username = properties.username;
    const roomCode = properties.roomCode;
    const existingUserID = properties.existingUser;

    if (existingUserID != null) {
      socketUser = this.mergeUsersFromSameOrigin(existingUserID, socketUser);
      socketUser.broadcastJSONToAllPeers('reconnect');
    }

    socketUser.activate();
    const room = this.roomHandler.getRoomOrCreateNewRoom(socketUser, username, roomCode);

    room.addUser(socketUser, username);
  }

  userJoinRoomFromRoomCode(socketUser: SocketUser, properties: ConnectionData) {
    const username = properties.username;
    const roomCode = properties.roomCode;

    if (socketUser.isActive && this.roomHandler.hasRoom(roomCode)) {
      const socketRoom = this.roomHandler.getRoom(roomCode!);
      socketRoom.addUser(socketUser, username);
    }
  }

  // ---- Room handling ----
  addNewRoom(socketUser: SocketUser, properties: ConnectionData) {
    const username = properties.username;

    // TODO Prevent "leaking" empty SocketRooms (Never even create empty rooms)
    const room = this.roomHandler.createNewRoom(socketUser, username);
    room.addUser(socketUser, username);
  }

  removeUserFromRoom(socketUser: SocketUser, socketRoom: SocketRoom) {
    // NOTE: The user is NOT deleted, but is kept with 0 rooms
    socketRoom.removeUser(socketUser);
  }


  // ---- User handling ----
  createUser(sock: ServerSocketBase, req: Request) {
    const user = new SocketUser(sock, req);
    this.users.set(sock, user);
    this.usersByID.set(user.id, user);
  }

  destroyUser(user: SocketUser) {
    if (!this.users.has(user.sock)) {
      throw new ScratchetError("Tried to destroy a user that doesn't exist.");
    }

    this.usersByID.delete(user.id);
    this.users.delete(user.sock);

    // This could for example fail if the Socket was closed before sending the initial message
    for (const socketRoom of user.getRooms()) {
      socketRoom.removeUser(user);
      socketRoom.sendJSONToUsers(user, 'disconnect');
    }
  }

  mergeUsersFromSameOrigin(existingUserID: number, targetUser: SocketUser) {
    const existingUser = this.usersByID.get(existingUserID);
    if (existingUser?.validateOriginEquality(targetUser)) {
      existingUser.merge(targetUser);
      this.destroyUser(targetUser);
      this.changeUserSocket(existingUser, targetUser.sock);
      this.handleReconnect(existingUser);
      return existingUser;
    }
    return targetUser;
  }

  changeUserSocket(socketUser: SocketUser, newSocket: ServerSocketBase) {
    socketUser.sock.removeAllEvents();
    socketUser.sock = newSocket;
    this.users.set(newSocket, socketUser);
  }
}
