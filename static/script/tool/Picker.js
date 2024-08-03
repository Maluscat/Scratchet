import * as Meta from '~/constants/meta.js';
import { ScratchetTool } from '~/tool/ScratchetTool.js';

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
    const style = hue === null ? 'transparent' : Meta.makeHSLString(hue);
    document.documentElement.style.setProperty('--picker-color', style);
  }
  get size() {
    return this.#size;
  }
  set size(size) {
    this.#size = size;
    const style = size === null ? 'var(--strokeWidth)' : `${size}px`;
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
