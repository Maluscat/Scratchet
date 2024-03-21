import type { SocketRoom, ConnectionData, MessageData } from 'SocketRoom';
import type { Context } from 'oak';

import { app, router } from 'router';
import { SocketUser } from 'SocketUser';
import { SocketRoomHandler } from 'SocketRoomHandler';
import { ScratchetError } from 'ScratchetError';
import * as Global from 'Global';


interface ReceivedEventInterfaceStructure {
  [key: string]: {
    required: {
      [key: string]: string;
    };
    fn?: (socketUser: SocketUser, val?: any, socketRoom?: SocketRoom) => void;
    passOn?: boolean;
  }
}


const users = new WeakMap();
export const roomHandler = new SocketRoomHandler();

// NOTE values with `passOn` MUST have a required room - This is not validated
const receivedEventsInterface: ReceivedEventInterfaceStructure = {
  connectInit: {
    required: {
      val: 'object'
    },
    fn: (socketUser, val) => {
      initializeUserConnection(socketUser, val!);
    }
  },
  joinRoom: {
    required: {
      val: 'object'
    },
    fn: (socketUser, val) => {
      userJoinRoomFromRoomCode(socketUser, val!);
    }
  },
  newRoom: {
    required: {
      val: 'object'
    },
    fn: (socketUser, val) => {
      addNewRoom(socketUser, val!);
    }
  },
  leave: {
    required: {
      room: 'number'
    },
    fn: (socketUser, val, socketRoom) => {
      removeUserFromRoom(socketUser, socketRoom!);
    },
    passOn: true
  },
  changeName: {
    required: {
      val: 'string',
      room: 'number'
    },
    fn: (socketUser, val, socketRoom) => {
      socketUser.setNameForRoom(socketRoom!, val!);
    },
    passOn: true
  },
  changeRoomName: {
    required: {
      val: 'string',
      room: 'number'
    },
    fn: (socketUser, val, socketRoom) => {
      // Does not care which user it came from: Everyone can rename it
      socketRoom!.setName(val!);
    },
    passOn: true
  },
  clearUser: {
    required: {
      room: 'number'
    },
    passOn: true
  },
};


router
  .get('/socket', (ctx: Context) => {
    const sock: WebSocket = ctx.upgrade();

    sock.addEventListener('open', () => {
      users.set(sock, new SocketUser(sock));
    });

    sock.addEventListener('close', () => {
      destroySocketUser(sock);
    });

    sock.addEventListener('message', (e: MessageEvent) => {
      const socketUser = users.get(sock);
      try {
        socketUser.rate.increment();
        if (socketUser.rate.isLimited) {
          throw new ScratchetError(`Rate limitation reached: ${socketUser.rate.getCount()}`);
        }

        if (e.data instanceof ArrayBuffer) {
          const dataArr = new Int16Array(e.data);
          const roomCode = dataArr[0];
          const socketRoom = roomHandler.getRoomWithUserExistanceCheck(socketUser, roomCode);
          const newBuffer = socketUser.prependIDToBuffer(dataArr);

          if (dataArr[1] === Global.MODE.BULK_INIT) {
            socketRoom.sendBulkInitData(socketUser, newBuffer);
          } else {
            // Pass data on
            socketRoom.sendAnyDataToUsers(socketUser, newBuffer);
          }
        } else if (typeof e.data === 'string') {
          handleReceivedEvent(socketUser, JSON.parse(e.data));
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
    });
  });

await app.listen({ port: 8002 });


// ---- Message event handling ----
function handleReceivedEvent(socketUser: SocketUser, data: MessageData) {
  if (!data) {
    throw new ScratchetError(`Couldn't parse socket event: No data supplied`);
  }

  if (!Object.hasOwn(receivedEventsInterface, data.evt)) {
    throw new ScratchetError(`Unrecognized event: ${JSON.stringify(data)}`);
  }
  const eventInterface = receivedEventsInterface[data.evt];

  // Check if all required fields are present and are of their required types
  for (const [requiredField, requiredType] of Object.entries(eventInterface.required)) {
    if (!Object.hasOwn(data, requiredField)) {
      throw new ScratchetError(`Event omitted required field '${requiredField}': ${JSON.stringify(data)}`);
    }
    if (typeof data[requiredField] !== requiredType) {
      throw new ScratchetError(`Event field '${requiredField}' is not of type '${requiredType}': ${JSON.stringify(data)}`);
    }
  }

  let socketRoom: SocketRoom;
  if ('room' in data) {
    socketRoom = roomHandler.getRoomWithUserExistanceCheck(socketUser, data.room);
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
function initializeUserConnection(socketUser: SocketUser, properties: ConnectionData) {
  // NOTE `properties` is guaranteed to be an object, but it could have no properties
  const username = properties.username;
  const roomCode = properties.roomCode;

  const user = socketUser.init();
  const room = roomHandler.getRoomOrCreateNewRoom(user, username, roomCode);

  room.addUser(user, username);
}

function userJoinRoomFromRoomCode(socketUser: SocketUser, properties: ConnectionData) {
  const username = properties.username;
  const roomCode = properties.roomCode;

  if (socketUser.isActive && roomHandler.hasRoom(roomCode)) {
    const socketRoom = roomHandler.getRoom(roomCode!);
    socketRoom.addUser(socketUser, username);
  }
}

function addNewRoom(socketUser: SocketUser, properties: ConnectionData) {
  const username = properties.username;

  // TODO Prevent "leaking" empty SocketRooms (Never even create empty rooms)
  const room = roomHandler.createNewRoom(socketUser, username);
  room.addUser(socketUser, username);
}

// ---- Room handling ----
function removeUserFromRoom(socketUser: SocketUser, socketRoom: SocketRoom) {
  // NOTE: The user is NOT deleted, but is kept with 0 rooms
  socketRoom.removeUser(socketUser);
  socketRoom.sendJSONToUsers(socketUser, 'leave');
}

function destroySocketUser(socket: WebSocket) {
  const socketUser = users.get(socket);
  users.delete(socket);

  // This could for example fail if the Socket was closed before sending the initial message
  if (socketUser.isActive) {
    for (const socketRoom of socketUser.getRooms()) {
      socketRoom.removeUser(socketUser);
      socketRoom.sendJSONToUsers(socketUser, 'disconnect');
    }
  }
}
