/**
 * @typedef { [ number, number ] } Position
 */

class CanvasView {
  static WIDTH = 8191;
  static HEIGHT = 8191;

  canvas;

  drawWorker;
  posHandler;

  #additionalData = [];

  /**
   * @param { HTMLCanvasElement } canvas
   * @param { number[][] } additionalData
   */
  constructor(canvas, additionalData) {
    this.#additionalData = additionalData;

    this.canvas = canvas;

    this.drawWorker = new Worker('./script/worker/drawHandler.worker.js');
    this.posHandler = new PositionDataHandler();

    const offscreenCanvas = this.canvas.transferControlToOffscreen();
    this.drawWorker.postMessage({
      event: 'init',
      values: {
        canvas: offscreenCanvas,
        width: this.canvas.clientWidth,
        height: this.canvas.clientHeight,
        dpr: CanvasViewTransform.getDevicePixelRatio(),
      }
    }, [ offscreenCanvas ]);
  }

  /** @param { ScratchetUser } [userHighlight] */
  update(userHighlight) {
    this.drawWorker.postMessage({
      event: 'update',
      values: {
        buffers: [ this.posHandler.buffer, ...this.#additionalData ],
      }
    });
  }
}
