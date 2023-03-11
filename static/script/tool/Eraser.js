class Eraser extends ScratchetTool {
  #sliders = {};


  get width() {
    return this.#sliders.width.value;
  }
  set width(value) {
    this.#sliders.width.value = value;
  }

  constructor() {
    super('eraser');

    const widthWrapper = ScratchetTool.createSliderWrapper('width-slider');
    this.#sliders.width = ScratchetTool.createWidthSlider(widthWrapper, 80);

    this.configBarContent.push(widthWrapper);
  }

  activate() {
    super.activate();
    this.#sliders.width.value = this.#sliders.width.value;
    ScratchetTool.setCSSStrokeWidth(this.#sliders.width);
  }
}
