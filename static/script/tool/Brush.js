import * as Meta from '~/constants/meta.js';
import { ScratchetTool } from '~/tool/ScratchetTool.js';

export const MAX_BRUSH_SIZE = 80;

export class Brush extends ScratchetTool {
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

    this.#sliders.width = ScratchetTool.createWidthSlider(widthWrapper, MAX_BRUSH_SIZE);
    this.#sliders.hue = new Slider89(hueWrapper, {
      range: [0, 360],
      precision: 0,
      structure: `
        <thumb>
          <:indicator class=[slider-hue-indicator] style=[background-color: ${Meta.makeHSLString('$value')};]>
        </thumb>
      `
    });

    if (onWidthChange) {
      this.#sliders.width.addEvent('change:value', ({ value }) => onWidthChange(value));
    }
    if (onHueChange) {
      this.#sliders.hue.addEvent('change:value', ({ value }) => onHueChange(value));
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

  /**
   * @param { WheelEvent } e
   * @param { -1 | 1 } direction
   */
  scroll(e, direction) {
    super.scroll();
    if (e.shiftKey) {
      this.hue += direction * 24;
    } else if (!e.ctrlKey) {
      this.width += direction * 7;
    }
  }
}
