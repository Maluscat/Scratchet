import * as Meta from '~/constants/meta.js';
import { UndoRedoBufferBase } from '~/buffer/UndoRedoBufferBase.js';

export class UndoBuffer extends UndoRedoBufferBase {
  constructor(...args) {
    super(Meta.MODE.UNDO, ...args);
  }
}
