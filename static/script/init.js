/*
 * data/socketData: bulk data received via socket
 * posData: self-contained metadata & position packet: [...metadata, pos1X, pos1Y, pos2X, pos2Y, ...]
 * posDataWrapper: wrapper for 1...n posData, used as pointer: [posData1, posData2, ...]
 * metadata: currently: [hue, width, lastPosX, lastPosY]
 */

const controller = new Controller();
const controls3D = new Controls3D(null, null, {
  mod: {
    tran: 1,
  },
  buttons: {
    tran: 1,
    rot: null
  },
  dontInvertTranY: true,
  keyModifier: {
    scale: {
      x: [ ['ctrlKey'] ],
      y: [ ['ctrlKey'] ],
    }
  }
});
const ui = new UIHandler();

/** @type { ClientSocketBase } */
let sock;

/** @type { ScratchetGlobal } */
var Global;
/** @type { Validator } */
var Validator;
/** @type { SocketBase } */
var SocketBase;


// ---- Wait for modules ----
Promise.all([
  import('./shared/Global.mjs'),
  import('./shared/Validator.mjs'),
  import('./shared/SocketBase.mjs'),
]).then(([ MetaModule, ValidatorModule, SocketBaseModule ]) => {
  Global = MetaModule;
  Validator = ValidatorModule;
  SocketBase = SocketBaseModule;

  joinRoomOverlayInput.pattern = Validator.JOINROOM_VALIDATE_REGEX.toString().slice(1, -1);

  const socket = new WebSocket(`ws://${location.host}${location.pathname}socket`);
  sock = new ClientSocketBase(socket, {
    pingInterval: 4000
  });
  sock.socket.addEventListener('open', controller.socketOpen.bind(controller))
  sock.socket.addEventListener('message', controller.socketReceiveMessage.bind(controller));

  controller.init();
});
