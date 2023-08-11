/**
 * @typedef { [ number, number ] } Position
 */

class CanvasView {
  static BEZIER_CONTROL_MOD = .4;

  canvas;
  ctx;

  posHandler;

  /** @param { HTMLCanvasElement } canvas */
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.posHandler = new PositionDataHandler();
  }


  /** @param { ScratchetUser } [userHighlight] */
  redraw(userHighlight) {
    // TODO skip unseen points
    const posWrapper = this.posHandler.buffer;
    let prevPosData;
    let prevPosDataWrapper;

    this.ctx.clearRect(0, 0, CanvasViewTransform.VIEW_WIDTH, CanvasViewTransform.VIEW_HEIGHT);

    for (const { posData, wrapperStack } of ScratchetCanvas.iteratePosWrapper(posWrapper)) {
      let isFromHighlightedUser = false;

      if (userHighlight != null) {
        isFromHighlightedUser = !userHighlight.posCache.includes(wrapperStack[1]);
      }
      if (!prevPosData
          || getClientMetaHue(posData) !== getClientMetaHue(prevPosData)
          || getClientMetaWidth(posData) !== getClientMetaWidth(prevPosData)
            /* This forces a stroke when changing from one user to another with highlight enabled */
          || userHighlight != null && (!userHighlight.posCache.includes(prevPosDataWrapper) !== isFromHighlightedUser)) {

        if (prevPosData) {
          this.ctx.stroke();
        }

        // ASSUMPTION: all posData in posDataWrapper have the same width and hue
        // because only the eraser can form multiple posData inside one wrapper
        this.setStrokeStyle(getClientMetaHue(posData), isFromHighlightedUser);
        this.setLineWidth(getClientMetaWidth(posData));

        this.ctx.beginPath();
      }

      this.drawFromPosData(posData);

      prevPosData = posData;
      if (wrapperStack[1] !== prevPosDataWrapper) {
        prevPosDataWrapper = wrapperStack[1];
      }
    }

    if (prevPosData) {
      this.ctx.stroke();

      this.setStrokeStyle();
      this.setLineWidth();
    }
  }

  // NOTE: Make it as portable/adoptable as possible for future purposes!
  /**
   * @param { Int16Array } posData
   * @param { number[] } posQueue
   * @param { [ number, number ] } lastCp
   */
  drawFromPosData(posData, posQueue, lastCp) {
    if (posQueue.length === 0) {
      lastCp = [ posData[META_LEN.BRUSH], posData[META_LEN.BRUSH + 1] ];
      this.ctx.moveTo(...lastCp);
    }

    for (let i = META_LEN.BRUSH; i < posData.length; i += 2) {
      if (posQueue.length === 6) {
        posQueue.shift();
        posQueue.shift();
      }
      // Avoid two consecutive equal positions
      if (posData[i] === posQueue.at(-2) && posData[i + 1] === posQueue.at(-1)) {
        continue;
      }

      posQueue.push(posData[i], posData[i + 1]);

      if (posQueue.length < 6) continue;

      /** @type Position */
      const startPos = [ posQueue[0], posQueue[1] ];
      /** @type Position */
      const computePos = [ posQueue[2], posQueue[3] ];
      /** @type Position */
      const endPos = [ posQueue[4], posQueue[5] ];

      const [ cp1, cp2 ] = this.getBezierControlPoints(startPos, computePos, endPos);

      this.ctx.bezierCurveTo(...lastCp, ...cp1, ...computePos);

      lastCp = cp2;
    }

    return lastCp;
  }


  /**
   * Draw the finishing points of a line.
   * @param { Int16Array } posData
   * @param { Position } lastCp
   */
  drawFromPosDataFinish(posData, lastCp) {
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
  getBezierControlPoints(startPos, computePos, endPos) {
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
  setLineWidth(width) {
    this.ctx.lineWidth = width;
  }
  setStrokeStyle(hue, hasReducedAlpha) {
    this.ctx.strokeStyle = makeHSLString(hue, hasReducedAlpha);
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
