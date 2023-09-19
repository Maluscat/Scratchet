'use strict';
class CanvasViewWorker extends CanvasDraw {
  static BEZIER_CONTROL_MOD = .35;

  canvas;

  /**
   * The device's current device pixel ratio.
   * @type { number }
   */
  dpr;


  /** @param { OffscreenCanvas } canvas */
  constructor(canvas) {
    super(canvas.getContext('2d'));
    this.canvas = canvas;
  }

  // ---- Updater functions ----
  setDimensions(width, height) {
    this.canvas.width = width;
    this.canvas.height = height;

    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
  }
  setDevicePixelRatio(dpr) {
    this.dpr = dpr;
  }

  // ---- Draw functions ----
  update(posWrappers) {
    const drawStartPos = this.getPosWithTransform(0, 0);
    const drawEndPos = this.getPosWithTransform(this.canvas.width, this.canvas.height);

    this.ctx.clearRect(...drawStartPos, ...drawEndPos);
    this.redraw(posWrappers);
  }

  // ---- Transformation functions ----
  setTransform(posWrappers, transformOrigin, scaleX, scaleY, tranX, tranY) {
    this.ctx.setTransform(scaleX, 0, 0, scaleY, tranX, tranY);
    this.#scaleByDevicePixelRatio();

    this.update(posWrappers);
  }

  #scaleByDevicePixelRatio() {
    this.ctx.scale(this.dpr, this.dpr);
  }

  // ---- Helper functions ----
  getPosWithTransform(posX, posY) {
    const transform = this.ctx.getTransform();

    return PositionDataHandler.getPosWithTransform(
      this.dpr, posX, posY, transform.e, transform.f, transform.a, transform.d);
  }
}
