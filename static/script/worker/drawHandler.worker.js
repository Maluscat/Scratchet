'use strict';
/**
 * @typedef { Object } ScratchetMessageEvent
 * @prop { string } event
 * @prop { any } [values]
 */

/** @type { OffscreenCanvas } */
let offscreenCanvas;
/** @type { OffscreenCanvasRenderingContext2D } */
let ctx;


self.onmessage = e => {
  if (typeof e.data === 'object') {

    /** @type { ScratchetMessageEvent } */
    const { event, values } = e.data;

    if (event in this) {
      // Call the given event as function
      this[event](values);
    } else {
      console.error(`No corresponding function for event ${event} found.`);
    }
  }
};


function init({ canvas }) {
  offscreenCanvas = canvas;
  ctx = canvas.getContext('2d');
}
