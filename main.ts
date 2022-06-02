import { Application, Router, Context } from 'https://deno.land/x/oak@v10.5.1/mod.ts';
import * as path from 'https://deno.land/std@0.132.0/path/mod.ts';

// IN CASE OF 'INTERNAL SERVER ERROR': --allow-read IS MISSING
const app = new Application();
const router = new Router();

interface MessageData {
  evt: string,
  usr?: number,
  room?: number,
  val?: string | ConnectionData
}
interface ConnectionData {
  roomCode?: number,
  name?: string
}

interface SocketData {
  id: number,
  name: string
}

let userIDCounter = 0;
const activeSockets: Map<WebSocket, SocketData> = new Map();
const activeRooms: Map<number, Set<WebSocket>> = new Map();
// The Set tracks the socket which still need to send their data to the init sock
const socketRequireInitQueue: Map<WebSocket, WeakSet<WebSocket>> = new Map();

router
  .get('/socket', (ctx: Context) => {
    const sock = ctx.upgrade();
    let sockID: number;

    sock.addEventListener('open', () => {
      sockID = userIDCounter++;
    });

    sock.addEventListener('close', () => {
      sendJSONToAllSockets(sock, sockID, 'disconnect');
      removeSocketFromInitQueue(sock);
      activeSockets.delete(sock);
    });

    sock.addEventListener('message', (e: MessageEvent) => {
      if (e.data instanceof ArrayBuffer) {
        const dataArr = new Int16Array(e.data);
        // Send initial bulk data
        if (dataArr[0] === -1) {
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
      } else {
        const data = JSON.parse(e.data);
        switch (data.evt) {
          case 'connectInit':
            initializeUserConnection(sock, sockID, data.val);
            break;
          case 'changeName':
            renameSocket(sock, data.val);
            /* No break! */
          case 'clearUser':
            // Pass the message on to every peer
            sendJSONToAllSockets(sock, sockID, data.evt, data.val);
            break;
          default:
            console.error(`error! Wrong message from Socket ${sockID}!`);
        }
      }
    });
  });

// ---- Message event handling ----
function initializeUserConnection(sock: WebSocket, sockID: number, properties?: ConnectionData) {
  let username = properties?.name;
  let roomCode = properties?.roomCode;

  if (!roomCode || !activeRooms.has(roomCode)) {
    roomCode = createNewRoomCode();
  }
  if (!username) {
    // TODO this can be taken from UsernameHandler
    username = 'User #' + sockID;
  }

  addSocketToInitQueue(sock);
  sendInitialConnectionData(sock, username, roomCode);
  sendJSONToAllSockets(sock, sockID, 'connect', {
    name: username,
    roomCode: roomCode
  });

  activeSockets.set(sock, {
    id: sockID,
    name: username
  });
}

// ---- ArrayBuffer handling ----
function bufferPrependUser(dataArr: Int16Array, sockID: number): ArrayBuffer {
  const newData = new Int16Array(dataArr.length + 1);
  newData.set(dataArr, 1);
  newData[0] = sockID;
  return newData.buffer;
}

// ---- Initial data queue state handling ----
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

function addUserToRoom(sock: WebSocket, roomCode: number) {
  activeRooms.get(roomCode)!.add(sock);
}

// ---- Socket handling ----
function sendJSONToAllSockets(roomCode: number | null, callingSock: WebSocket, userID: number, event: string, value?: string | ConnectionData) {
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
  const data = JSON.stringify(dataObj);

  for (const socket of targetSockets!) {
    if (socket != callingSock && socket.readyState === 1) {
      socket.send(data);
    }
  }
}

function sendInitialConnectionData(roomCode: number, receivingSock: WebSocket, initialUsername: string) {
  const peerArr = new Array();
  for (const socket of activeRooms.get(roomCode)!) {
    const {id, name} = activeSockets.get(socket)!;
    peerArr.push([id, name]);
  }

  const data = JSON.stringify({
    evt: 'connectData',
    val: {
      room: roomCode,
      name: initialUsername,
      peers: peerArr
    }
  });
  receivingSock.send(data);
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
