'use strict';
class CanvasViewTransform extends CanvasView {
  static MAX_SCALE = CanvasViewTransform.scaleInterpolateFnInverse(20); // 2000 %
  minScale = 0;

  currentMousePos = [0, 0];

  /**
   * Represents the current transformation state of the canvas.
   * This is functionally equivalent to `ctx.getTransform()`,
   * which is not easily accessible as it resides in the worker.
   */
  currentState;
  state;

  /** @param { HTMLCanvasElement } canvas */
  constructor(canvas, ...superArgs) {
    super(canvas, ...superArgs);

    this.setDimensions();

    this.state = new State3D(this.setTransform.bind(this), {
      scale: {
        x: 0,
        y: 0
      },
      // Start at the view center
      tran: {
        x: -((CanvasView.WIDTH + 1) / 2 - this.canvas.width / 2),
        y: -((CanvasView.HEIGHT + 1) / 2 - this.canvas.height / 2)
      }
    });

    this.currentState = new State3D(null, this.state.state);
  }

  /**
   * Returns the interpolated (i.e. "real") scale of {@link state}.
   * @return { Position }
   */
  getScale() {
    return [
      CanvasViewTransform.scaleInterpolateFn(this.state.scale.x),
      CanvasViewTransform.scaleInterpolateFn(this.state.scale.y),
    ];
  }

  /**
   * Returns the interpolated (i.e. "real") scale of {@link currentState}.
   * @return { Position }
   */
  getCurrentScale() {
    return [
      CanvasViewTransform.scaleInterpolateFn(this.currentState.scale.x),
      CanvasViewTransform.scaleInterpolateFn(this.currentState.scale.y),
    ];
  }

  // NOTE Remember to apply the device pixel ratio when working with deltas and positions
  /**
   * @param { Controls3DDrawInfo } [drawInfo]
   */
  setTransform(drawInfo, useCenterOrigin = false) {
    const transformOrigin = (drawInfo?.touches)
      ? Controls3D.computeTouchesMidpoint(...drawInfo.touches)
      : (useCenterOrigin
        ? CanvasViewTransform.getViewportCenter()
        : this.currentMousePos);

    // TODO Convert to scaleMax and move the canvas around somehow (undrawable sections other color + border)?
    this.#limitStateScale();
    const [scaleX, scaleY] = this.getScale();

    this.#translateViewTowardCursor(transformOrigin);
    this.#limitStateTran();

    this.ctx.setTransform(scaleX, 0, 0, scaleY, this.state.tran.x, this.state.tran.y);
    this.#scaleByDevicePixelRatio();
    this.currentState.assignNewState(this.state.state);

    ui.resizeDrawIndicator(scaleX);

    this.update();

    if (!Slider89.floatIsEqual(ui.scaleSlider.value, this.state.scale.x)) {
      this.updateScaleSlider();
    }
  }

  /** @param { DeepPartial<State> } newState */
  setTransformWithNewState(newState, ...args) {
    this.state.assignNewState(newState);
    this.setTransform(...args);
  }

  setDimensions() {
    const dpr = CanvasViewTransform.getDevicePixelRatio();
    this.offscreenCanvas.height = this.canvas.clientHeight * dpr;
    this.offscreenCanvas.width = this.canvas.clientWidth * dpr;

    this.minScale = CanvasViewTransform.scaleInterpolateFnInverse(
      Math.max(
        this.canvas.width / CanvasView.WIDTH,
        this.canvas.height / CanvasView.HEIGHT));

    ui.scaleSlider.range[0] = this.minScale;

    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
  }

  updateScaleSlider() {
    ui.scaleSlider.value = this.state.scale.x;
  }

  setCurrentMousePos(posX, posY) {
    this.currentMousePos[0] = posX;
    this.currentMousePos[1] = posY;
  }

  // ---- Helper functions ----
  #getScaleDelta() {
    const [scaleX, scaleY] = this.getScale();
    const [currentScaleX, currentScaleY] = this.getCurrentScale();
    const dpr = CanvasViewTransform.getDevicePixelRatio();

    const DELTA_PRECISION = 1000000;
    // These should always be equivalent, but computed separately in case of discrepancies
    return [
      Math.round((dpr * scaleX - currentScaleX) * DELTA_PRECISION) / DELTA_PRECISION,
      Math.round((dpr * scaleY - currentScaleY) * DELTA_PRECISION) / DELTA_PRECISION
    ];
  }

  // ---- Transformation functions ----
  #scaleByDevicePixelRatio() {
    const dpr = CanvasViewTransform.getDevicePixelRatio();
    this.ctx.scale(dpr, dpr);
  }

  /**
   * Zoom towards the mouse position.
   */
  #translateViewTowardCursor(mousePos) {
    const [deltaScaleX, deltaScaleY] = this.#getScaleDelta();
    const [posX, posY] = this.getPosWithTransformFloat(mousePos[0], mousePos[1]);

    this.state.tran.x -= deltaScaleX * posX;
    this.state.tran.y -= deltaScaleY * posY;
  }

  #limitStateScale() {
    if (this.state.scale.x < this.minScale) {
      this.state.scale.x = this.minScale;
    } else if (this.state.scale.x > CanvasViewTransform.MAX_SCALE) {
      this.state.scale.x = CanvasViewTransform.MAX_SCALE;
    }

    if (this.state.scale.y < this.minScale) {
      this.state.scale.y = this.minScale;
    } else if (this.state.scale.y > CanvasViewTransform.MAX_SCALE) {
      this.state.scale.y = CanvasViewTransform.MAX_SCALE;
    }
  }

  #limitStateTran() {
    const [scaleX, scaleY] = this.getScale();

    const viewStopX = (CanvasView.WIDTH * scaleX) - this.canvas.width;
    const viewStopY = (CanvasView.HEIGHT * scaleY) - this.canvas.height;

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

  // ---- Static helpers ----
  static getDevicePixelRatio() {
    return Math.floor(window.devicePixelRatio);
  }

  static getViewportCenter() {
    return [
      Math.trunc(document.documentElement.clientWidth / 2),
      Math.trunc(document.documentElement.clientHeight / 2)
    ];
  }

  // ---- Static math helpers ---
  static scaleInterpolateFn(x) {
    return Math.pow(Math.E, 1.05 * x);
  }
  static scaleInterpolateFnInverse(x) {
    return Math.log(x) / 1.05;
  }
}
