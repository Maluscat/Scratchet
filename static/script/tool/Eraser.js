class Eraser extends ScratchetTool {
  #sliders = {};


  get width() {
    return this.#sliders.width.value;
  }

  constructor() {
    super('eraser');

    const widthWrapper = ScratchetTool.createSliderWrapper('width-slider');
    this.#sliders.width = ScratchetTool.createWidthSlider(widthWrapper, 80);

    this.onActivate = () => {
      this.#sliders.width.value = this.#sliders.width.value;
    }


    this.configBarContent.push(widthWrapper);
  }
}
