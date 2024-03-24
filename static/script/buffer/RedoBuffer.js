import * as Meta from '~/constants/meta.js';
import { UndoRedoBufferBase } from '~/buffer/UndoRedoBufferBase.js';

export class RedoBuffer extends UndoRedoBufferBase {
  constructor(...args) {
    super(Meta.MODE.REDO, ...args);
  }
}
