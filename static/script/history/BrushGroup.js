/**
 * @typedef { object } UndoBrushInfo
 * @prop { number[][] } data The PosWrapper containing all points.
 * @prop { Array } target The target wrapper for the data.
 */

class BrushGroup {
  /** @type { UndoBrushInfo[] } */
  #redoData = [];
  #length;

  #userBuffer;

  constructor(userBuffer, length) {
    this.#length = length;
    this.#userBuffer = userBuffer;
    this.#prepareBuffer();
  }

  undo() {
    for (const info of this.#redoData) {
      info.target.length = 0;
    }
  }
  redo() {
    for (const info of this.#redoData) {
      info.target.push(info.data);
    }
  }

  /** @param { ScratchetUser } user */
  cleanup(user) {
    for (const info of this.#redoData) {
      user.deleteFromBuffer(info.target);
    }
  }

  #prepareBuffer() {
    for (let i = this.#userBuffer.length - 1; i >= this.#userBuffer.length - this.#length; i--) {
      const posWrapper = this.#userBuffer[i];
      const info = {
        data: Array.from(posWrapper),
        target: posWrapper
      };
      this.#redoData.push(info);
    }
  }
}
