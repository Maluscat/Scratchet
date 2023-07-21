class UndoBuffer extends UndoRedoBufferBase {
  constructor(...args) {
    super(Global.MODE.UNDO, ...args);
  }
}
