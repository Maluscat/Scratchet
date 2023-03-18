'use strict';
class Brush extends ScratchetTool {
  #sliders = {};


  get width() {
    return this.#sliders.width.value;
  }
  set width(value) {
    this.#sliders.width.value = value;
  }

  get hue() {
    return this.#sliders.hue.value;
  }
  set hue(value) {
    this.#sliders.hue.value = value;
  }

  constructor(onWidthChange, onHueChange) {
    super('brush');

    const widthWrapper = ScratchetTool.createSliderWrapper('width-slider');
    const hueWrapper = ScratchetTool.createSliderWrapper('hue-slider');

    this.#sliders.width = ScratchetTool.createWidthSlider(widthWrapper, 80);
    this.#sliders.hue = new Slider89(hueWrapper, {
      range: [0, 360],
      precision: 0,
      structure: `
        <thumb>
          <:indicator class=[slider-hue-indicator] style=[background-color: ${makeHSLString('$value')};]>
        </thumb>
      `
    });

    if (onWidthChange) {
      this.#sliders.width.addEvent('change:value', s => onWidthChange(s.value));
    }
    if (onHueChange) {
      this.#sliders.hue.addEvent('change:value', s => onHueChange(s.value));
    }


    this.configBarContent.push(widthWrapper);
    this.configBarContent.push(hueWrapper);
  }

  // Trigger slider style recomputation
  activate() {
    super.activate();
    this.#sliders.width.value = this.#sliders.width.value;
    this.#sliders.hue.value = this.#sliders.hue.value;
    ScratchetTool.setCSSStrokeWidth(this.#sliders.width);
  }
}
