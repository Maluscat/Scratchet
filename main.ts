import { Application, Router, Context } from 'https://deno.land/x/oak@v10.5.1/mod.ts';
import * as path from 'https://deno.land/std@0.132.0/path/mod.ts';
import type { SocketID, RoomCode } from './SocketUser.ts';
import type { SocketRoom, ConnectionData, MessageData } from './SocketRoom.ts';
import { SocketUser } from './SocketUser.ts';
import { SocketRoomHandler } from './SocketRoomHandler.ts';
import { ScratchetError } from './ScratchetError.ts';

// IN CASE OF 'INTERNAL SERVER ERROR': --allow-read IS MISSING
const app = new Application();
const router = new Router();


interface ReceivedEventInterfaceStructure {
  [key: string]: {
    required: {
      [key: string]: string;
    };
    fn?: (socketUser: SocketUser, val?: any, socketRoom?: SocketRoom) => void;
    passOn?: boolean;
  }
}


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
    let socketUser: SocketUser;

    sock.addEventListener('open', () => {
      socketUser = new SocketUser(sock);
    });

    sock.addEventListener('close', () => {
      destroyUser(socketUser);
    });

    sock.addEventListener('message', (e: MessageEvent) => {
      try {
        if (e.data instanceof ArrayBuffer) {
          const dataArr = new Int16Array(e.data);
          const roomCode = dataArr[0];
          const socketRoom = roomHandler.getRoomWithUserExistanceCheck(socketUser, roomCode);
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
          throw new ScratchetError(`Received an unknown socket response:\n${e.data}`);
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

// ---- Message event handling ----
function handleReceivedEvent(socketUser: SocketUser, data: MessageData) {
  if (!data) {
    throw new ScratchetError(`Couldn't parse socket event: No data supplied`);
  }

  if (!Object.hasOwn(receivedEventsInterface, data.evt)) {
    throw new ScratchetError(`Unrecognized event:\n${data}`);
  }
  const eventInterface = receivedEventsInterface[data.evt];

  // Check if all required fields are present and are of their required types
  for (const [requiredField, requiredType] of Object.entries(eventInterface.required)) {
    if (!Object.hasOwn(data, requiredField)) {
      throw new ScratchetError(`Event omitted required field ${requiredField}:\n${data}`);
    }
    if (typeof data[requiredField] !== requiredType) {
      throw new ScratchetError(`Event field ${requiredField} is not of type ${requiredType}:\n${data}`);
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

// ---- Room handling ----
function removeUserFromRoom(socketUser: SocketUser, socketRoom: SocketRoom) {
  // NOTE: The user is NOT deleted, but is kept with 0 rooms
  socketRoom.removeUser(socketUser);
  socketRoom.sendJSONToUsers(socketUser, 'leave');
}

function destroyUser(socketUser: SocketUser) {
  // This could for example fail if the Socket was closed before sending the initial message
  if (socketUser.isActive) {
    for (const socketRoom of socketUser.getRooms()) {
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
