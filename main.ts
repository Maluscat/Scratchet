import { Application, Router, Context } from 'https://deno.land/x/oak@v10.5.1/mod.ts';
import * as path from 'https://deno.land/std@0.132.0/path/mod.ts';

// IN CASE OF 'INTERNAL SERVER ERROR': --allow-read IS MISSING
const app = new Application();
const router = new Router();

interface SocketData {
  evt: string,
  usr?: number,
  val?: string
}

let userIDCounter = 0;
const activeSockets: Set<WebSocket> = new Set();
// The Set tracks the socket which still need to send their data to the init sock
const socketRequireInitQueue: Map<WebSocket, WeakSet<WebSocket>> = new Map();

router
  .get('/socket', (ctx: Context) => {
    const sock = ctx.upgrade();
    let sockID: number;

    sock.addEventListener('open', () => {
      sockID = userIDCounter++
      activeSockets.add(sock);
      addSocketToInitQueue(sock);
      sendJSONToAllSockets(sock, sockID, 'connect');
      sendJSONToOneSocket(sock, 'assignUserID', sockID.toString());
    });

    sock.addEventListener('close', () => {
      sendJSONToAllSockets(sock, sockID, 'disconnect');
      removeSocketFromInitQueue(sock);
      activeSockets.delete(sock);
    });

    sock.addEventListener('message', (e: MessageEvent) => {
      if (e.data instanceof ArrayBuffer) {
        const dataArr = new Int32Array(e.data);
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
          for (const socket of activeSockets) {
            if (socket != sock && socket.readyState === 1) {
              socket.send(newBuffer);
            }
          }
        }
      } else {
        const data = JSON.parse(e.data);
        switch (data.evt) {
          case 'clearUser':
            sendJSONToAllSockets(sock, sockID, data.evt);
            break;
          default:
            console.error('error! Wrong message!');
        }
      }
    });
  });

// ---- ArrayBuffer handling ----
function bufferPrependUser(dataArr: Int32Array, sockID: number): ArrayBuffer {
  const newData = new Int32Array(dataArr.length + 1);
  newData.set(dataArr, 1);
  newData[0] = sockID;
  return newData.buffer;
}

// ---- Initial data queue state handling ----
function addSocketToInitQueue(sock: WebSocket) {
  if (activeSockets.size > 1) {
    socketRequireInitQueue.set(sock, new WeakSet([sock]));

    setTimeout(function() {
      removeSocketFromInitQueue(sock);
    }, 1000 * 10);
  }
}
function removeSocketFromInitQueue(sock: WebSocket) {
  socketRequireInitQueue.delete(sock);
}

// ---- Socket handling ----
function sendJSONToOneSocket(receivingSock: WebSocket, event: string, value: string) {
  const dataObj: SocketData = {
    evt: event,
    val: value
  };
  const data = JSON.stringify(dataObj);
  receivingSock.send(data);
}

function sendJSONToAllSockets(callingSock: WebSocket, userID: number, event: string) {
  const dataObj: SocketData = {
    evt: event,
    usr: userID
  };
  const data = JSON.stringify(dataObj);

  for (const socket of activeSockets) {
    if (socket != callingSock && socket.readyState === 1) {
      socket.send(data);
    }
  }
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
