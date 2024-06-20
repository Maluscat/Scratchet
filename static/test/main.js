import { assert } from './lib/chai-v5-1-1.min.js';
import { BrushGroup } from '~/history/BrushGroup.js';
import { EraserGroup } from '~/history/EraserGroup.js';

describe('History', () => {
  describe('Group equality', () => {
    const randomData = [];
    for (let i = 0; i < randInt(120, 80); i++) {
      const wrapper = [];
      randomData.push(wrapper);
      for (let j = 0; j < randInt(20, 6); j++) {
        const posData = [];
        for (let k = 0; k < randInt(10, 1); k++) {
          posData.push(randInt(4095));
        }
        wrapper.push(new Int16Array(posData));
      }
    }

    it('Brush', () => {
      /** @type { Array<BrushGroup> } */
      const brushes = new Array(3);
      for (let i = 0; i < brushes.length; i++) {
        brushes[i] = new BrushGroup();
        brushes[i].addData(...structuredClone(randomData));
        brushes[i].close(Infinity);
      }
      brushes[2].historyData[0].posWrapper[0][0] -= 1;

      assert(brushes[0].equal(brushes[1]), "Should be equal.\n");
      assert(!brushes[0].equal(brushes[2]), "Should not be equal.\n");
    });
    it('Eraser', () => {
      const eraser = new Array(3);
      for (let i = 0; i < eraser.length; i++) {
        const data = structuredClone(randomData);
        eraser[i] = new BrushGroup();
        eraser[i].addData(...structuredClone(randomData));
        eraser[i].close(Infinity);
      }
      eraser[2].historyData[0].posWrapper[0][0] -= 1;

      assert(eraser[0].equal(eraser[1]), "Should be equal.\n");
      assert(!eraser[0].equal(eraser[2]), "Should not be equal.\n");
    })
  });
});

function randInt(max = 10, min = 0) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
