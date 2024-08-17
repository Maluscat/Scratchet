import { UIHandler } from '~/ui/UIHandler.js';
import { Controller } from '~/Controller.js';
import { ScratchetSocketBase } from '~/socket/ScratchetSocketBase.js';
import { PositionDataHandler } from '~/PositionDataHandler.js';

/*
 * data/socketData: bulk data received via socket
 * posData: self-contained metadata & position packet: [...metadata, pos1X, pos1Y, pos2X, pos2Y, ...]
 * posDataWrapper: wrapper for 1...n posData, used as pointer: [posData1, posData2, ...]
 * metadata: currently: [hue, width, lastPosX, lastPosY]
 */


const url = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}${location.pathname}socket`;
const sock = new ScratchetSocketBase(url, {
  maxReconnectTimeoutDuration: 4000,
});

export const controller = new Controller(sock);
export const ui = new UIHandler();
export const controls3D = new Controls3D(null, null, {
  mod: {
    tran: 1,
  },
  buttons: {
    tran: 1,
    rot: null
  },
  keyModifier: {
    scale: {
      x: [ ['ctrlKey'] ],
      y: [ ['ctrlKey'] ],
    }
  }
});


controller.init();

window.controller = controller;
window.controls3D = controls3D;
window.ui = ui;
window.PositionDataHandler = PositionDataHandler;
