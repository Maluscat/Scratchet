import * as Global from '~/shared/Global.mjs';
import { UndoRedoBufferBase } from '~/buffer/UndoRedoBufferBase.js';

export class UndoBuffer extends UndoRedoBufferBase {
  constructor(...args) {
    super(Global.MODE.UNDO, ...args);
  }
}
