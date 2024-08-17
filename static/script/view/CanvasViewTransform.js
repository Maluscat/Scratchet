import { CanvasView } from '~/view/CanvasView.js';
import { controls3D, ui } from '~/init.js';

export class CanvasViewTransform extends CanvasView {
  /** Maximum LINEAR scale the view can assume. */
  static MAX_SCALE = document.documentElement.clientWidth > 1080
    ? 20
    : document.documentElement.clientWidth > 650
      ? 15
      : 7.5;
  /**
   * Minimum LINEAR scale the view can assume.
   * Is computed and set in {@link setDimensions}.
   */
  minScale = 0;

  currentMousePos = [0, 0];

  state;

  constructor(...superArgs) {
    super(...superArgs);

    this.setDimensions();

    this.state = new State3D(this.setTransform.bind(this), {
      // Start at the view center
      tran: this.#getCanvasCenter()
    });
  }

  getScaleX() {
    return controls3D.touchIsActive
      ? this.state.scale.x
      : CanvasViewTransform.scaleInterpolateFn(this.state.scale.x);
  }
  getScaleY() {
    return controls3D.touchIsActive
      ? this.state.scale.y
      : CanvasViewTransform.scaleInterpolateFn(this.state.scale.y);
  }

  // NOTE Remember to apply the device pixel ratio when working with deltas and positions
  /** @param { Controls3DDrawInfo } [drawInfo] */
  setTransform(drawInfo, useCenterOrigin = false) {
    const dpr = CanvasViewTransform.getDevicePixelRatio();
    const transformOrigin = (drawInfo?.touches)
      ? Controls3D.getTouchesMidpoint(...drawInfo.touches)
      : (useCenterOrigin
        ? CanvasViewTransform.getViewportCenter()
        : this.currentMousePos);

    // TODO Convert to scaleMax and move the canvas around somehow (undrawable sections other color + border)?
    this.#limitStateScale();

    this.#translateViewTowardCursor(transformOrigin);
    this.#limitStateTran();

    this.ctx.setTransform(
      this.getScaleX() * dpr, 0, 0, this.getScaleY() * dpr,
      this.state.tran.x * dpr, this.state.tran.y * dpr);

    ui.resizeIndicator(this.getScaleX());

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
    this.canvas.height = this.canvas.clientHeight * dpr;
    this.canvas.width = this.canvas.clientWidth * dpr;

    this.minScale = Math.max(
      this.canvas.clientWidth / CanvasView.WIDTH,
      this.canvas.clientHeight / CanvasView.HEIGHT);

    ui.scaleSlider.range[0] = CanvasViewTransform.scaleInterpolateFnInverse(this.minScale);

    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
  }

  updateScaleSlider() {
    ui.scaleSlider.value = controls3D.touchIsActive
      ? CanvasViewTransform.scaleInterpolateFnInverse(this.state.scale.x)
      : this.state.scale.x;
  }

  setCurrentMousePos(posX, posY) {
    this.currentMousePos[0] = posX;
    this.currentMousePos[1] = posY;
  }

  // ---- Helper functions ----
  #getScaleDelta() {
    const dpr = CanvasViewTransform.getDevicePixelRatio();
    const currentTransform = this.ctx.getTransform();
    const DELTA_PRECISION = 1000000;
    // These should always be equivalent, but computed separately in case of discrepancies
    return [
      Math.round((dpr * this.getScaleX() - currentTransform.a) * DELTA_PRECISION) / DELTA_PRECISION,
      Math.round((dpr * this.getScaleX() - currentTransform.d) * DELTA_PRECISION) / DELTA_PRECISION
    ];
  }
  #getCanvasCenter() {
    const dpr = CanvasViewTransform.getDevicePixelRatio();
    return {
      x: -((CanvasView.WIDTH + 1) / 2 - this.canvas.width / 2) / dpr,
      y: -((CanvasView.HEIGHT + 1) / 2 - this.canvas.height / 2) / dpr,
    };
  }

  // ---- Transformation functions ----
  /** Zoom towards the mouse position. */
  #translateViewTowardCursor(mousePos) {
    const dpr = CanvasViewTransform.getDevicePixelRatio();
    const [deltaScaleX, deltaScaleY] = this.#getScaleDelta();
    const [posX, posY] = this.getPosWithTransformFloat(mousePos[0], mousePos[1]);

    this.state.tran.x -= deltaScaleX * posX / dpr;
    this.state.tran.y -= deltaScaleY * posY / dpr;
  }

  #limitStateScale() {
    const minScale = controls3D.touchIsActive
      ? this.minScale
      : CanvasViewTransform.scaleInterpolateFnInverse(this.minScale);
    const maxScale = controls3D.touchIsActive
      ? CanvasViewTransform.MAX_SCALE
      : CanvasViewTransform.scaleInterpolateFnInverse(CanvasViewTransform.MAX_SCALE);

    if (this.state.scale.x < minScale) {
      this.state.scale.x = minScale;
    } else if (this.state.scale.x > maxScale) {
      this.state.scale.x = maxScale;
    }

    if (this.state.scale.y < minScale) {
      this.state.scale.y = minScale;
    } else if (this.state.scale.y > maxScale) {
      this.state.scale.y = maxScale;
    }
  }

  #limitStateTran() {
    const dpr = CanvasViewTransform.getDevicePixelRatio();
    const viewStopX = ((CanvasView.WIDTH * dpr * this.getScaleX()) - this.canvas.width) / dpr;
    const viewStopY = ((CanvasView.HEIGHT * dpr * this.getScaleY()) - this.canvas.height) / dpr;

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
    return Math.pow(Math.E, 1.05 * (x - 1));
  }
  static scaleInterpolateFnInverse(x) {
    return Math.log(x) / 1.05 + 1;
  }
}
