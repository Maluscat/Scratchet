import { Application, Router, Context } from 'https://deno.land/x/oak@v10.5.1/mod.ts';
import * as path from 'https://deno.land/std@0.132.0/path/mod.ts';
import type { SocketID, RoomCode } from './SocketUser.ts';
import type { ConnectionData, MessageData } from './SocketRoom.ts';
import { SocketRoom } from './SocketRoom.ts';
import { SocketUser } from './SocketUser.ts';
import { SocketRoomHandler } from './SocketRoomHandler.ts';

// IN CASE OF 'INTERNAL SERVER ERROR': --allow-read IS MISSING
const app = new Application();
const router = new Router();


interface ReceivedEventInterfaceStructure {
  [key: string]: {
    required: {
      [key: string]: string;
    };
    fn?: (socketUser: SocketUser, val: any, socketRoom?: SocketRoom) => void;
    passOn?: boolean;
  }
}


export const roomHandler = new SocketRoomHandler();
// The Set tracks the socket which still need to send their data to the init sock
const socketRequireInitQueue: Map<SocketUser, WeakSet<SocketUser>> = new Map();

// NOTE values with `passOn` MUST have a required room - This is not validated
const receivedEventsInterface: ReceivedEventInterfaceStructure = {
  connectInit: {
    required: {
      val: 'object'
    },
    fn: initializeUserConnection
  },
  joinRoom: {
    required: {
      val: 'object'
    },
    fn: (socketUser, val) => {
      userJoinRoomFromRoomCode(socketUser, val!);
    }
  },
  leave: {
    required: {
      room: 'number'
    },
    fn: (socketUser, val, socketRoom) => {
      removeUserFromRoom(socketUser, socketRoom!)
    },
    passOn: true
  },
  changeName: {
    required: {
      val: 'string',
      room: 'number'
    },
    fn: (socketUser, val, socketRoom) => {
      socketUser.setNameForRoom(socketRoom, val);
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
    let socketUser: SocketUser;

    sock.addEventListener('open', () => {
      socketUser = new SocketUser(sock);
    });

    sock.addEventListener('close', () => {
      destroyUser(socketUser);
    });

    sock.addEventListener('message', (e: MessageEvent) => {
      if (e.data instanceof ArrayBuffer) {
        const dataArr = new Int16Array(e.data);
        const roomCode = dataArr[0];
        if (!roomHandler.hasRoom(roomCode)) {
          console.warn(`${socketUser}: Room #${roomCode} does not exist!`);
          return;
        }
        const socketRoom = roomHandler.getRoom(roomCode);

        // TODO validate, whether the user actually is in the specified room
        // -> We might need the SocketUser room handling for this again

        const newBuffer = socketUser.prependIDToBuffer(dataArr);

        if (dataArr[1] === -1) {
          socketRoom.sendBulkInitData(socketUser, newBuffer);
        } else {
          // Pass data on
          socketRoom.sendAnyDataToUsers(socketUser, newBuffer);
        }
      } else if (typeof e.data === 'string') {
        handleReceivedEvent(socketUser, JSON.parse(e.data));
      } else {
        console.warn(`Warning! Received an unknown socket response:\n${e.data}`);
      }
    });
  });

// ---- Message event handling ----
function handleReceivedEvent(socketUser: SocketUser, data: MessageData) {
  if (!data) {
    console.warn(`Warning: couldn't parse socket event: No data supplied`);
    return;
  }

  if (!Object.hasOwn(receivedEventsInterface, data.evt)) {
    console.warn(`Warning! Unrecognized event from ${socketUser}:\n${data}`);
    return;
  }
  const eventInterface = receivedEventsInterface[data.evt];

  // Check if all required fields are present and are of their required types
  for (const [requiredField, requiredType] of Object.entries(eventInterface.required)) {
    if (!Object.hasOwn(data, requiredField)) {
      console.warn(`Warning! Event omitted required field ${requiredField}:\n${data}`);
      return;
    }
    if (typeof data[requiredField] !== requiredType) {
      console.warn(`Warning! Event field ${requiredField} is not of type ${requiredType}:\n${data}`);
      return;
    }
  }

  // TODO also check if user is in room
  if ('room' in data && !roomHandler.hasRoom(data.room)) {
    console.warn(`${socketUser}: Room #${data.room} does not exist!`);
    return;
  }
  const socketRoom = roomHandler.getRoom(data.room!);

  if ('fn' in eventInterface) {
    eventInterface.fn!(socketUser, data.val, socketRoom);
  }

  // NOTE: objects are excluded here, val may only be a string right now
  if (eventInterface.passOn && typeof data.val !== 'object' && socketRoom != null) {
    socketRoom.sendJSONToUsers(socketUser, data.evt, data.val);
  }
}

// ---- Message event response ----
function initializeUserConnection(socketUser: SocketUser, properties?: ConnectionData) {
  const username = properties?.name;
  const roomCode = properties?.roomCode;

  const room = roomHandler.getRoomOrCreateNewRoom(roomCode);
  const user = socketUser.init();

  room.addUser(user, username);
}

function userJoinRoomFromRoomCode(socketUser: SocketUser, properties?: ConnectionData) {
  const username = properties?.name;
  const roomCode = properties?.roomCode;

  if (socketUser.isActive && roomHandler.hasRoom(roomCode)) {
    const socketRoom = roomHandler.getRoom(roomCode);
    socketRoom.addUser(socketUser, username);
  }
}

// ---- Room handling ----
function removeUserFromRoom(socketUser: SocketUser, socketRoom: SocketRoom) {
  // NOTE: The user is NOT deleted, but is kept with 0 rooms
  socketRoom.removeUser(socketUser);
  socketRoom.sendJSONToUsers(socketUser, 'leave');
}

function destroyUser(socketUser: SocketUser) {
  // This could for example fail if the Socket was closed before sending the initial message
  if (socketUser.isActive) {
    // TODO do not loop over every existing room, but over every room of a user
    for (const socketRoom of roomHandler.getAllRooms()) {
      socketRoom.removeUser(socketUser);
      socketRoom.sendJSONToUsers(socketUser, 'disconnect');
    }
  }
  // TODO Garbage collect the user properly
}


// ---- Oak boilerplate stuff ----
app.use(router.routes());
app.use(router.allowedMethods());

// static routing with 404 fallback
app.use(async (ctx, next) => {
  await next();
  try {
    await ctx.send({
      root: path.join(Deno.cwd(), 'static'),
      index: 'index.html'
    });
  } catch (e) {
    ctx.response.status = 404;
    ctx.response.body = '404';
  }
});

app.addEventListener('listen', function(e) {
  console.log("Listening on port ༼ つ ◕_◕ ༽つ " + e.port);
});
await app.listen({ port: 8002 });
