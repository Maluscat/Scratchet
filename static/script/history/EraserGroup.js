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
  historyData;

  /** @param { EraserHistoryData[] } data */
  constructor(data) {
    super();
    this.historyData = EraserGroup.#buildHistoryData(data);
  }

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

  cleanup = this.undo;

  /** @param { EraserHistoryData[] } undoOutline */
  static #buildHistoryData(undoOutline) {
    for (const info of undoOutline) {
      info.posWrapper = [ ...info.target ];
    }
    return undoOutline;
  }
}
