import * as Meta from '~/constants/meta.js';
import { ScratchetTool } from './ScratchetTool.js';
import { MAX_BRUSH_SIZE } from './Brush.js';

export class Picker extends ScratchetTool {
  hasPicked = false;
  sizeToggle;
  hueToggle;

  /** @type { null | number } */
  #hue = null;
  /** @type { null | number } */
  #size = null;

  get hue() {
    return this.#hue;
  }
  set hue(hue) {
    this.#hue = hue;
    const style = hue === null ? 'var(--canvas-color)' : Meta.makeHSLString(hue);
    document.documentElement.style.setProperty('--picker-color', style);
  }
  get size() {
    return this.#size;
  }
  set size(size) {
    this.#size = size;
    size ??= 25;
    const style = (size * .35 + (MAX_BRUSH_SIZE * .4) - (MAX_BRUSH_SIZE * .4) * .35) + 'px';
    document.documentElement.style.setProperty('--picker-size', style);
  }

  constructor() {
    super('picker');
    const [ sizeLabel, sizeInput ] = ScratchetTool.createToggle('sample-width', 'Size');
    const [ hueLabel, hueInput ] = ScratchetTool.createToggle('sample-height', 'Color');

    this.sizeToggle = sizeInput;
    this.hueToggle = hueInput;
    this.hueToggle.checked = true;

    this.configBarContent.push(hueLabel);
    this.configBarContent.push(sizeLabel);

    // Initialization
    this.size = null;
    this.hue = null;
  }

  activate() {
    super.activate();
    this.hasPicked = false;
  }

  resetValues() {
    this.hue = null;
    this.size = null;
  }

  resolveToggleState() {
    if (!this.sizeToggle.checked && !this.hueToggle.checked) {
      this.hueToggle.checked = true;
    }
  }
}
