class CanvasView {
  canvas;
  ctx;


  /** @param { HTMLCanvasElement } canvas */
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
  }


  /**
   * @param { Array } posWrapper
   * @param { ScratchetUser } [userHighlight]
   */
  redraw(posWrapper, userHighlight) {
    // TODO skip unseen points
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

  drawFromPosData(posData) {
    this.ctx.moveTo(posData[META_LEN.BRUSH], posData[META_LEN.BRUSH + 1]);
    let i = META_LEN.BRUSH;
    for (; i < posData.length - 4; i += 6) {
      this.ctx.bezierCurveTo(posData[i], posData[i + 1], posData[i + 2], posData[i + 3], posData[i + 4], posData[i + 5]);
    }
    // Draw the finishing points of the wrapper in case the wrapper hasn't fully been drawn above
    if (i === posData.length - 4) {
      this.ctx.quadraticCurveTo(posData[i], posData[i + 1], posData[i + 2], posData[i + 3]);
    } else if (i === posData.length - 2) {
      this.ctx.lineTo(posData[i], posData[i + 1]);
    }
  }


  // ---- Misc helper functions ----
  setLineWidth(width) {
    this.ctx.lineWidth = width;
  }
  setStrokeStyle(hue, hasReducedAlpha) {
    this.ctx.strokeStyle = makeHSLString(hue, hasReducedAlpha);
  }
}
