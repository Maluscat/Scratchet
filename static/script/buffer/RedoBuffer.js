import * as Global from '~/shared/Global.mjs';
import { UndoRedoBufferBase } from '~/buffer/UndoRedoBufferBase.js';

export class RedoBuffer extends UndoRedoBufferBase {
  constructor(...args) {
    super(Global.MODE.REDO, ...args);
  }
}
