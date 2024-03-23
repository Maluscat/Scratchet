import { ScratchetTool } from '~/tool/ScratchetTool.js';

export class Eraser extends ScratchetTool {
  #sliders = {};


  get width() {
    return this.#sliders.width.value;
  }
  set width(value) {
    this.#sliders.width.value = value;
  }

  constructor(onWidthChange) {
    super('eraser');

    const widthWrapper = ScratchetTool.createSliderWrapper('width-slider');
    this.#sliders.width = ScratchetTool.createWidthSlider(widthWrapper, 300);
    if (onWidthChange) {
      this.#sliders.width.addEvent('change:value', s => onWidthChange(s.value));
    }

    this.configBarContent.push(widthWrapper);
  }

  activate() {
    super.activate();
    this.#sliders.width.value = this.#sliders.width.value;
    ScratchetTool.setCSSStrokeWidth(this.#sliders.width);
  }
}
