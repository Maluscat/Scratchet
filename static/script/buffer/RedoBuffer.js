class RedoBuffer extends UndoRedoBufferBase {
  constructor(...args) {
    super(Global.MODE.REDO, ...args);
  }
}
