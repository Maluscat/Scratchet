import * as Meta from '~/constants/meta.js';
import { CanvasViewTransform } from '~/view/CanvasViewTransform.js';
import { PositionDataHandler } from '~/PositionDataHandler.js';

/** @typedef { import('~/user/User.js').User } User */
/** @typedef { [ number, number ] } Position */

export class CanvasView {
  static WIDTH = 8191;
  static HEIGHT = 8191;

  static BEZIER_CONTROL_MOD = .35;

  canvas;
  ctx;

  #posHandler;
  #additionalData = [];

  /**
   * @param { HTMLCanvasElement } canvas
   * @param { PositionDataHandler } posHandler
   * @param { number[][] } additionalData
   */
  constructor(canvas, posHandler, additionalData) {
    this.#additionalData = additionalData;
    this.#posHandler = posHandler;
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
  }

  /** @param { User } [userHighlight] */
  update(userHighlight) {
    const drawStartPos = this.getPosWithTransform(0, 0);
    const drawEndPos = this.getPosWithTransform(this.canvas.width, this.canvas.height);

    this.ctx.clearRect(...drawStartPos, ...drawEndPos);
    this.#redraw([ this.#posHandler.buffer, ...this.#additionalData ], userHighlight);
  }

  /**
   * @param { number[][] } posWrappers
   * @param { User } [userHighlight]
   */
  #redraw(posWrappers, userHighlight) {
    let posQueue = [];
    let lastCp;
    let prevPosData;
    let prevPosDataWrapper;

    PositionDataHandler.iteratePosWrappers(posWrappers, ({ posData, wrapperStack }) => {
      const metaHasChanged = prevPosData && PositionDataHandler.posDataMetaHasChanged(prevPosData, posData);
      const isNotContinuous = prevPosData && PositionDataHandler.posDataIsNotContinuous(prevPosData, posData);
      let isFromHighlightedUser = false;

      if (userHighlight != null) {
        isFromHighlightedUser = !userHighlight.posCache.includes(wrapperStack[1]);
      }

      if (metaHasChanged || isNotContinuous) {
        this.#drawFromPosDataEnd(prevPosData, lastCp);
        posQueue = [];
        lastCp = null;
      }

      if (metaHasChanged
          || !prevPosData
            /* This forces a stroke when changing from one user to another with highlight enabled */
          || userHighlight != null && (!userHighlight.posCache.includes(prevPosDataWrapper) !== isFromHighlightedUser)) {

        if (prevPosData) {
          this.ctx.stroke();
        }

        // ASSUMPTION: all posData in posDataWrapper have the same width and hue
        // because only the eraser can form multiple posData inside one wrapper
        this.setStrokeStyle(Meta.getClientHue(posData), isFromHighlightedUser);
        this.setLineWidth(Meta.getClientWidth(posData));

        this.ctx.beginPath();
      }

      lastCp = this.#drawFromPosData(posData, posQueue, lastCp);

      prevPosData = posData;
      if (wrapperStack[1] !== prevPosDataWrapper) {
        prevPosDataWrapper = wrapperStack[1];
      }
    });

    if (prevPosData) {
      this.#drawFromPosDataEnd(prevPosData, lastCp);

      this.ctx.stroke();

      this.setStrokeStyle();
      this.setLineWidth();
    }
  }

  /**
   * Draw a smooth line from the given posData. `posQueue` collects every
   * Position in consecutive order to allow carrying them over.
   * @param { Int16Array } posData
   * @param { number[] } posQueue Collects every {@link Position} in consecutive order.
   * @param { Position } lastCp The control point of the last pass.
   * @return { Position } The second control point of the center {@link Position}.
   */
  #drawFromPosData(posData, posQueue, lastCp) {
    // If this is the first pass of a new line
    if (posQueue.length === 0) {
      lastCp = [ posData[Meta.LEN.BRUSH], posData[Meta.LEN.BRUSH + 1] ];
      this.ctx.moveTo(...lastCp);
    }

    for (let i = Meta.LEN.BRUSH; i < posData.length; i += 2) {
      // Avoid two consecutive equal positions
      if (posData[i] === posQueue.at(-2) && posData[i + 1] === posQueue.at(-1)) {
        continue;
      }

      if (posQueue.length === 6) {
        posQueue.splice(0, 2);
      }
      posQueue.push(posData[i], posData[i + 1]);

      if (posQueue.length < 6) continue;

      const startPos = getQueuePos(0);
      const computePos = getQueuePos(1);
      const endPos = getQueuePos(2);

      const [ cp1, cp2 ] = this.#getBezierControlPoints(startPos, computePos, endPos);

      this.ctx.bezierCurveTo(...lastCp, ...cp1, ...computePos);

      lastCp = cp2;
    }

    return lastCp;


    /**
     * @param { number } offset
     * @return { Position }
     */
    function getQueuePos(offset) {
      offset *= 2;
      return [ posQueue[offset], posQueue[offset + 1] ];
    }
  }


  /**
   * Draw the finishing points of a given posData.
   * @param { Int16Array } posData
   * @param { Position } lastCp
   */
  #drawFromPosDataEnd(posData, lastCp) {
    this.ctx.bezierCurveTo(
      ...lastCp,
      posData.at(-2),
      posData.at(-1),
      posData.at(-2),
      posData.at(-1));
  }

  /**
   * Get the bézier control points needed for a smooth line between three points.
   * The control points correspond to the center point (the second parameter).
   * @param { Position } startPos
   * @param { Position } computePos
   * @param { Position } endPos
   * @return { [ Position, Position ] } Both control points of `computePos`.
   */
  #getBezierControlPoints(startPos, computePos, endPos) {
    const distanceStartCompute = CanvasView.getPosDistance(startPos, computePos);
    const distanceComputeEnd = CanvasView.getPosDistance(computePos, endPos);
    const distanceTotal = distanceStartCompute + distanceComputeEnd;

    const scaleFactor1 = CanvasView.BEZIER_CONTROL_MOD * distanceStartCompute / distanceTotal;
    const scaleFactor2 = CanvasView.BEZIER_CONTROL_MOD * distanceComputeEnd / distanceTotal;

    return [
      computeControlPoint(-scaleFactor1),
      computeControlPoint(scaleFactor2)
    ];


    /**
     * @param { number } factor The scale factor to apply.
     * @return { Position }
     */
    function computeControlPoint(factor) {
      return [
        computePos[0] + factor * (endPos[0] - startPos[0]),
        computePos[1] + factor * (endPos[1] - startPos[1]),
      ];
    }
  }


  // ---- Misc helper functions ----
  /**
   * Get the canvas' hue at the specified position or false if there is none.
   *
   * This needs the pure mouse positions WITHOUT transformations applied!
   * @param { number } posX
   * @param { number } posY
   * @return { number | false }
   */
  getHueAtPosition(posX, posY) {
    const color = this.ctx.getImageData(posX, posY, 1, 1).data;
    if (color[3] === 0) {
      return false;
    }
    return Math.round(Meta.getHueFromRGB(color[0], color[1], color[2]));
  }

  /** @param { number } width */
  setLineWidth(width) {
    this.ctx.lineWidth = width;
  }
  /**
   * @param { number } hue
   * @param { boolean } [hasReducedAlpha]
   */
  setStrokeStyle(hue, hasReducedAlpha) {
    this.ctx.strokeStyle = Meta.makeHSLString(hue, hasReducedAlpha);
  }


  // ---- Transform helper functions ----
  getPosWithTransformFloat(posX, posY) {
    const currentTransform = this.ctx.getTransform();
    const dpr = CanvasViewTransform.getDevicePixelRatio();
    return [
      (posX * dpr - currentTransform.e) / currentTransform.a,
      (posY * dpr - currentTransform.f) / currentTransform.d
    ];
  }
  /**
   * Returns floored position data based on the current transform.
   * Floored is useful in order to mitigate discrepancies between client and peers
   * because transmitted (position) data is always floored in the TypedArray.
   * @param { number } posX
   * @param { number } posY
   * @return { Position }
   */
  getPosWithTransform(posX, posY) {
    return this.getPosWithTransformFloat(posX, posY)
      .map(pos => Math.floor(pos));
  }


  // ---- Static helper functions ----
  /**
   * Returns the distance between two position vectors.
   * @param { Position } pos0
   * @param { Position } pos1
   * @return { number } The distance between {@link pos0} and {@link pos1}
   */
  static getPosDistance(pos0, pos1) {
    return Math.sqrt(Math.pow(pos1[0] - pos0[0], 2) + Math.pow(pos1[1] - pos0[1], 2));
  }
}
