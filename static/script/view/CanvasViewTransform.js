import { CanvasView } from '~/view/CanvasView.js';
import { ui } from '~/init.js';

export class CanvasViewTransform extends CanvasView {
  static MAX_SCALE = CanvasViewTransform.scaleInterpolateFnInverse(20); // 2000 %
  minScale = 0;

  currentMousePos = [0, 0];

  state;

  /** @param { HTMLCanvasElement } canvas */
  constructor(canvas, ...superArgs) {
    super(canvas, ...superArgs);

    // TODO this probably needs to be integrated into setTransform
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
  }

  getScaleX() {
    return CanvasViewTransform.scaleInterpolateFn(this.state.scale.x);
  }
  getScaleY() {
    return CanvasViewTransform.scaleInterpolateFn(this.state.scale.y);
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

    this.#translateViewTowardCursor(transformOrigin);
    this.#limitStateTran();

    this.ctx.setTransform(this.getScaleX(), 0, 0, this.getScaleY(), this.state.tran.x, this.state.tran.y);
    ui.resizeIndicator(this.getScaleX());

    this.#scaleByDevicePixelRatio();

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
    const currentTransform = this.ctx.getTransform();
    const dpr = CanvasViewTransform.getDevicePixelRatio();

    const DELTA_PRECISION = 1000000;
    // These should always be equivalent, but computed separately in case of discrepancies
    return [
      Math.round((dpr * this.getScaleX() - currentTransform.a) * DELTA_PRECISION) / DELTA_PRECISION,
      Math.round((dpr * this.getScaleY() - currentTransform.d) * DELTA_PRECISION) / DELTA_PRECISION
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
    const viewStopX = (CanvasView.WIDTH * this.getScaleX()) - this.canvas.width;
    const viewStopY = (CanvasView.HEIGHT * this.getScaleY()) - this.canvas.height;

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
