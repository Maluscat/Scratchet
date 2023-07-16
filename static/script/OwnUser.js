'use strict';
class OwnUser extends ScratchetUser {
  brushUndo = {
    groups: [],
    groupIndex: 0
  };


  // ---- Undo Brush grouping ----
  addBrushUndoGroup(initialLength) {
    const count = this.posCache.length - initialLength;
    if (count > 0) {
      this.brushUndo.groups.push(count);
      this.brushUndo.groupIndex++;
    }
  }

  getNextBrushUndoGroup() {
    return this.brushUndo.groups[this.brushUndo.groupIndex];
  }
}
