import { Application, Router, Context } from 'https://deno.land/x/oak@v10.5.1/mod.ts';
import * as path from 'https://deno.land/std@0.132.0/path/mod.ts';

// IN CASE OF 'INTERNAL SERVER ERROR': --allow-read IS MISSING
const app = new Application();
const router = new Router();


interface MessageData {
  [key: string]: any;

  evt: string;
  usr?: SocketID;
  room?: RoomCode;
  val?: string | ConnectionData;
}
interface ConnectionData {
  roomCode?: RoomCode;
  name?: string;
}

interface SocketData {
  id: SocketID;
  name: string;
  defaultName: string;
  rooms: Set<RoomCode>;
}

interface ReceivedEventInterfaceStructure {
  [key: string]: {
    required: {
      [key: string]: string;
    };
    fn?: (sock: WebSocket, sockID: SocketID, val: any, room?: RoomCode) => void;
    passOn?: boolean;
  }
};

type SocketID = number;
type RoomCode = number;


let userIDCounter = 0;

const activeSockets: Map<WebSocket, SocketData> = new Map();
const activeRooms: Map<RoomCode, Set<WebSocket>> = new Map();
// The Set tracks the socket which still need to send their data to the init sock
const socketRequireInitQueue: Map<WebSocket, WeakSet<WebSocket>> = new Map();

const receivedEventsInterface: ReceivedEventInterfaceStructure = {
  connectInit: {
    required: {
      val: 'object'
    },
    fn: initializeUserConnection
  },
  joinRoom: {
    required: {
      val: 'number'
    },
    fn: initializeUserJoin
  },
  leave: {
    required: {
      room: 'number'
    },
    fn: (sock, sockID, val, room) => removeUserFromRoom(sock, sockID, room!),
    passOn: true
  },
  changeName: {
    required: {
      val: 'string',
      room: 'number'
    },
    fn: (sock, sockID, val, room) => renameSocket(sock, val),
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
    const sock = ctx.upgrade();
    let sockID: SocketID;

    sock.addEventListener('open', () => {
      sockID = userIDCounter++;
    });

    sock.addEventListener('close', () => {
      deleteUser(sock, sockID);
    });

    sock.addEventListener('message', (e: MessageEvent) => {
      if (e.data instanceof ArrayBuffer) {
        const dataArr = new Int16Array(e.data);
        const roomCode = dataArr[0];
        if (!activeRooms.has(roomCode)) {
          return;
        }

        // Send initial bulk data
        if (dataArr[1] === -1) {
          // Go through the queue until finding a socket which this one hasn't served yet
          for (const [servedSock, handledSocks] of socketRequireInitQueue) {
            if (!handledSocks.has(sock)) {
              const newBuffer = bufferPrependUser(dataArr, sockID);
              servedSock.send(newBuffer);
              handledSocks.add(sock);
              break;
            }
          }
        } else {
          const newBuffer = bufferPrependUser(dataArr, sockID);

          for (const socket of activeRooms.get(roomCode)!) {
            if (socket != sock && socket.readyState === 1) {
              socket.send(newBuffer);
            }
          }
        }
      } else if (typeof e.data === 'string') {
        handleReceivedEvent(sock, sockID, JSON.parse(e.data));
      } else {
        console.warn(`Warning! Received an unknown socket response:\n${e.data}`);
      }
    });
  });

// ---- Message event handling ----
function handleReceivedEvent(sock: WebSocket, sockID: SocketID, data: MessageData) {
  if (!data) {
    console.warn(`Warning: couldn't parse socket event`);
    return;
  }

  if (!Object.hasOwn(receivedEventsInterface, data.evt)) {
    console.warn(`Warning! Unrecognized event from Socket ${sockID}:\n${data}`);
    return;
  }
  const eventInterface = receivedEventsInterface[data.evt];

  // Check if all required fields are present and are of their required types
  for (const [ requiredField, requiredType ] of Object.entries(eventInterface.required)) {
    if (!Object.hasOwn(data, requiredField)) {
      console.warn(`Warning! Event omitted required field ${requiredField}:\n${data}`);
      return;
    }
    if (typeof data[requiredField] !== requiredType) {
      console.warn(`Warning! Event field ${requiredField} is not of type ${requiredType}:\n${data}`);
      return;
    }
  }

  if ('fn' in eventInterface) {
    eventInterface.fn!(sock, sockID, data.val, data.room);
  }

  // NOTE: objects are excluded here, val can only be a string
  if (eventInterface.passOn && typeof data.val !== 'object') {
    sendJSONToAllSockets(data.room, sock, sockID, data.evt, data.val);
  }
}

// ---- Message event response ----
function initializeUserConnection(sock: WebSocket, sockID: SocketID, properties?: ConnectionData) {
  let username = properties?.name;
  let roomCode = properties?.roomCode;
  // TODO this can be taken from UsernameHandler
  const defaultUsername = username = 'User #' + sockID;

  if (!roomCode || !activeRooms.has(roomCode)) {
    roomCode = createNewRoomCode();
  }
  if (!username) {
    username = defaultUsername;
  }

  const socketData: SocketData = {
    id: sockID,
    name: username,
    defaultName: defaultUsername,
    rooms: new Set()
  };

  activeSockets.set(sock, socketData);

  addUserToRoom(sock, sockID, roomCode, username);

  addSocketToInitQueue(sock);
  sendInitialJoinData(sock, roomCode, socketData);
}

function initializeUserJoin(sock: WebSocket, sockID: SocketID, roomCode: RoomCode) {
  if (activeRooms.has(roomCode)) {
    addUserToRoom(sock, sockID, roomCode);
    sendInitialJoinData(sock, roomCode);
  }
}

// ---- ArrayBuffer handling ----
function bufferPrependUser(dataArr: Int16Array, sockID: SocketID): ArrayBuffer {
  const newData = new Int16Array(dataArr.length + 1);
  newData.set(dataArr, 1);
  newData[0] = sockID;
  return newData.buffer;
}

// ---- Initial data queue state handling ----
// TODO: track this per room
function addSocketToInitQueue(sock: WebSocket) {
  if (activeSockets.size > 0) {
    socketRequireInitQueue.set(sock, new WeakSet([sock]));

    setTimeout(function() {
      removeSocketFromInitQueue(sock);
    }, 1000 * 10);
  }
}
function removeSocketFromInitQueue(sock: WebSocket) {
  socketRequireInitQueue.delete(sock);
}

// ---- Room handling ----
function createNewRoomCode() {
  let roomcode;
  do {
    // Generate random number of interval [1000, 9999]
    roomcode = Math.floor(Math.random() * 9000 + 1000);
  } while (activeRooms.has(roomcode));
  activeRooms.set(roomcode, new Set());
  return roomcode;
}

function addUserToRoom(sock: WebSocket, sockID: SocketID, roomCode: RoomCode, username: string = activeSockets.get(sock)!.name) {
  const roomSockets = activeRooms.get(roomCode)!;

  roomSockets.add(sock);
  activeSockets.get(sock)!.rooms.add(roomCode);

  sendJSONToAllSockets(roomCode, sock, sockID, 'join', username);
}

function removeUserFromRoom(sock: WebSocket, sockID: SocketID, roomCode: RoomCode) {
  const socketRoomCodes = activeSockets.get(sock)!.rooms;

  // NOTE: The user is NOT deleted, but is kept with 0 rooms
  deleteSocketFromRoomSet(sock, roomCode);
  socketRoomCodes.delete(roomCode);
  removeSocketFromInitQueue(sock);

  sendJSONToAllSockets(roomCode, sock, sockID, 'leave');
}

function deleteUser(sock: WebSocket, sockID: SocketID) {
  // This could for example fail if the Socket was closed before sending the initial message
  if (activeSockets.has(sock)) {
    const socketRoomCodes = activeSockets.get(sock)!.rooms;

    for (const roomCode of socketRoomCodes) {
      deleteSocketFromRoomSet(sock, roomCode)
    }
    // socketRoomCodes should be getting garbage collected
    activeSockets.delete(sock);

    // TODO currently, the sendJSONToAllSockets `undefined` broadcast sends a message to *all* sockets
    // However, this should be room-specific
    sendJSONToAllSockets(undefined, sock, sockID, 'disconnect');
  }
}

// ---- Socket handling ----
function sendJSONToAllSockets(roomCode: RoomCode | undefined, callingSock: WebSocket, userID: SocketID, event: string, value?: string) {
  let targetSockets;

  // TODO: validate room code
  if (roomCode != null) {
    targetSockets = activeRooms.get(roomCode);
  } else {
    targetSockets = activeSockets.keys();
  }

  const dataObj: MessageData = {
    evt: event,
    usr: userID
  };
  if (value != null) {
    dataObj.val = value;
  }
  if (roomCode != null) {
    dataObj.room = roomCode;
  }
  const data = JSON.stringify(dataObj);

  for (const socket of targetSockets!) {
    if (socket != callingSock && socket.readyState === 1) {
      socket.send(data);
    }
  }
}

// ---- Initial data ----
function sendInitialJoinData(receivingSock: WebSocket, roomCode: RoomCode, socketData: SocketData = activeSockets.get(receivingSock)!) {
  const initialUsername = socketData.name;
  const defaultUsername = socketData.defaultName;

  const peerArr = new Array();
  for (const socket of activeRooms.get(roomCode)!) {
    if (socket !== receivingSock) {
      // TODO
      const { id, name } = activeSockets.get(socket)!;
      peerArr.push([id, name]);
    }
  }

  // NOTE: `defaultName` is sent on every new join request redundantly
  //   for simplicity purposes
  const data = JSON.stringify({
    evt: 'joinData',
    val: {
      room: roomCode,
      name: initialUsername,
      defaultName: defaultUsername,
      peers: peerArr
    }
  });
  receivingSock.send(data);
}

// ---- Helper functions ----
function deleteSocketFromRoomSet(sock: WebSocket, roomCode: RoomCode) {
  const roomSockets = activeRooms.get(roomCode)!;

  roomSockets.delete(sock);
  if (roomSockets.size === 0) {
    activeRooms.delete(roomCode);
  }
}

function renameSocket(sock: WebSocket, newUsername: string) {
  // The `!` is a TypeScript non-null assertion
  activeSockets.get(sock)!.name = newUsername;
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
