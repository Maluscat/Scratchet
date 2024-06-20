import { HistoryGroup } from './HistoryGroup.js';

/**
 * NOTE: This extends an imaginary interface that ensures that the properties
 * `posWrapper` and `target` stay the same over all group history data interfaces.
 * @typedef { Object } EraserHistoryData
 * @prop { Array<Array> } initialWrapper A copy of the original PosWrapper.
 *                                       Is used to reinstate the target to its original form.
 * @prop { Array<Array> } posWrapper A copy of the PosWrapper after the erase process.
 *                                   Is used to redo the target to its erased form.
 * @prop { Array<Array> } target The target PosWrapper that holds the erased/initial PosData.
 */

export class EraserGroup extends HistoryGroup {
  /** @type { EraserHistoryData[] } */
  historyData = [];


  undo() {
    for (const info of this.historyData) {
      info.target.splice(0, info.target.length, info.initialWrapper);
    }
  }
  redo() {
    for (const info of this.historyData) {
      info.target.splice(0, info.target.length, info.posWrapper);
    }
  }

  /**
   * Add an eraser undo entry to the eraser history stack
   * if no wrapper with the specified target already exists.
   * @param { Int16Array[][] } targetWrapper See {@link EraserHistoryData.target}
   * @param { Int16Array[][] } initialWrapper See {@link EraserHistoryData.initialWrapper}
   */
  addData(targetWrapper, initialWrapper) {
    if (!this.historyData.some(data => data.target === targetWrapper)) {
      this.addDataUnchecked(targetWrapper, initialWrapper);
    }
  }
  /**
   * Add an eraser undo entry to the eraser history stack
   * without any additional condition.
   * @param { Int16Array[][] } targetWrapper See {@link EraserHistoryData.target}
   * @param { Int16Array[][] } initialWrapper See {@link EraserHistoryData.initialWrapper}
   */
  addDataUnchecked(targetWrapper, initialWrapper) {
    this.historyData.push(/** @type EraserHistoryData */ ({
      initialWrapper,
      posWrapper: null,
      target: targetWrapper
    }));
  }

  /** The eraser group can only be closed once. */
  close(intactCount) {
    if (this.intactCount == null) {
      super.close(intactCount);
      for (const info of this.historyData) {
        info.posWrapper = [ ...info.target ];
      }
    }
  }

  cleanup = this.undo;
}
