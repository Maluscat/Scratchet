'use strict';
class ScratchetCanvasControls {
  static VIEW_WIDTH = 8191;
  static VIEW_HEIGHT = 8191;

  canvas;
  ctx;
  currentMousePos = [0, 0];

  state;

  /**
   * @param { HTMLCanvasElement } canvas
   */
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');

    // TODO this probably needs to be integrated into setTransform
    this.setDimensions();

    this.state = new State3D(this.setTransform.bind(this), {
      scale: {
        x: 1,
        y: 1
      },
      // Start at the view center
      tran: {
        x: -((ScratchetCanvasControls.VIEW_WIDTH + 1) / 2 - this.canvas.width / 2),
        y: -((ScratchetCanvasControls.VIEW_HEIGHT + 1) / 2 - this.canvas.height / 2)
      }
    });
  }

  // NOTE Remember to apply the device pixel ratio when working with deltas and positions
  setTransform(controlsOptions) {
    const transformOrigin = (controlsOptions?.touches)
      ? Controls3D.computeTouchesMidpoint(...controlsOptions.touches)
      : this.currentMousePos;

    // TODO Convert to scaleMax and move the canvas around somehow (undrawable sections other color + border)?
    this.limitStateScale();

    this.translateViewTowardCursor(transformOrigin);
    this.limitStateTran();

    this.ctx.setTransform(this.state.scale.x, 0, 0, this.state.scale.y, this.state.tran.x, this.state.tran.y);
    ui.resizeDrawIndicator(this.state.scale.x);

    this.scaleByDevicePixelRatio();

    this.redrawCanvas();
  }

  setDimensions() {
    const dpr = this.getDevicePixelRatio();
    this.canvas.height = this.canvas.clientHeight * dpr;
    this.canvas.width = this.canvas.clientWidth * dpr;

    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
  }

  setCurrentMousePos(posX, posY) {
    this.currentMousePos[0] = posX;
    this.currentMousePos[1] = posY;
  }

  getPosWithTransformFloat(posX, posY) {
    const currentTransform = this.ctx.getTransform();
    const dpr = this.getDevicePixelRatio();
    return [
      (posX * dpr - currentTransform.e) / currentTransform.a,
      (posY * dpr - currentTransform.f) / currentTransform.d
    ];
  }
  /**
   * Returns floored position data based on the current transform.
   * Floored is useful in order to mitigate discrepancies between client and peers
   * because transmitted (position) data is always floored in the TypedArray.
   */
  getPosWithTransform(posX, posY) {
    return this.getPosWithTransformFloat(posX, posY)
      .map(pos => Math.floor(pos));
  }

  // ---- Helper functions ----
  getDevicePixelRatio() {
    return Math.floor(window.devicePixelRatio);
  }

  getScaleDelta() {
    const currentTransform = this.ctx.getTransform();
    const dpr = this.getDevicePixelRatio();

    const DELTA_PRECISION = 1000000;
    // These should always be equivalent, but computed separately in case of discrepancies
    return [
      Math.round((dpr * this.state.scale.x - currentTransform.a) * DELTA_PRECISION) / DELTA_PRECISION,
      Math.round((dpr * this.state.scale.y - currentTransform.d) * DELTA_PRECISION) / DELTA_PRECISION
    ];
  }

  // ---- Transformation functions ----
  scaleByDevicePixelRatio() {
    const dpr = this.getDevicePixelRatio();
    this.ctx.scale(dpr, dpr);
  }

  /**
   * Zoom towards the mouse position.
   */
  translateViewTowardCursor(mousePos) {
    const [deltaScaleX, deltaScaleY] = this.getScaleDelta();
    const [posX, posY] = this.getPosWithTransformFloat(mousePos[0], mousePos[1]);

    this.state.tran.x -= deltaScaleX * posX;
    this.state.tran.y -= deltaScaleY * posY;
  }

  limitStateScale() {
    const scaleMin = Math.max(
      this.canvas.width / ScratchetCanvasControls.VIEW_WIDTH,
      this.canvas.height / ScratchetCanvasControls.VIEW_HEIGHT);

    if (this.state.scale.x < scaleMin) {
      this.state.scale.x = scaleMin;
    } else if (this.state.scale.x > 4) {
      this.state.scale.x = 4;
    }

    if (this.state.scale.y < scaleMin) {
      this.state.scale.y = scaleMin;
    } else if (this.state.scale.y > 4) {
      this.state.scale.y = 4;
    }
  }

  limitStateTran() {
    const viewStopX = (ScratchetCanvasControls.VIEW_WIDTH * this.state.scale.x) - this.canvas.width;
    const viewStopY = (ScratchetCanvasControls.VIEW_HEIGHT * this.state.scale.y) - this.canvas.height;

    if (this.state.tran.x > 0) {
      this.state.tran.x = 0;
      ui.invokeHitBorder('left');
    } else if (this.state.tran.x < -viewStopX) {
      this.state.tran.x = -viewStopX;
      ui.invokeHitBorder('right');
    }

    if (this.state.tran.y > 0) {
      this.state.tran.y = 0;
      ui.invokeHitBorder('top');
    } else if (this.state.tran.y < -viewStopY) {
      this.state.tran.y = -viewStopY;
      ui.invokeHitBorder('bottom');
    }
  }
}
