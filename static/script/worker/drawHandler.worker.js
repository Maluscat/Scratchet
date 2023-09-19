'use strict';
/**
 * @typedef { Object } ScratchetMessageEvent
 * @prop { string } event
 * @prop { any } [values]
 */

importScripts(
  './CanvasDraw.worker.js',
  './CanvasView.worker.js',
  '../Meta.js',
  '../PositionDataHandler.js',
);

/** @type { CanvasViewWorker } */
let view;


self.onmessage = e => {
  /** @type { ScratchetMessageEvent } */
  const { event, values } = e.data;

  if (event in this) {
    // Call the given event as function
    this[event](values);
  } else {
    console.error(`No corresponding function for event ${event} found.`);
  }
};


function init({ canvas, dpr, width, height }) {
  view = new CanvasViewWorker(canvas);
  view.setDimensions(width, height);
  view.setDevicePixelRatio(dpr);
}

function update({ buffers }) {
  view.update(buffers);
}

function setDimensions({ width, height }) {
  view.setDimensions(width, height);
}
// TODO: There is no update event yet to send this event on dpr change
function setDevicePixelRatio({ dpr }) {
  view.setDevicePixelRatio(dpr);
}

function setTransform(args) {
  view.setTransform(...args);
}
