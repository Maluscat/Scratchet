class ScratchetTool {
  static toolbar = document.getElementById('toolbar');
  static configBarWrapper = document.getElementById('tool-config-bar');

  buttonNode;
  configBarContent = [];

  constructor(toolName) {
    if (!toolName) {
      throw new Error('No tool name has been passed!');
    }

    this.buttonNode = document.querySelector(`[data-tool="${toolName}"]`);
  }


  // ---- Activation handling ----
  activate() {
    ScratchetTool.toolbar.querySelector('.active').classList.remove('active');
    this.buttonNode.classList.add('active');
    this.#populateConfigBar();
  }


  // ---- config bar ----
  #populateConfigBar() {
    ScratchetTool.configBarWrapper.replaceChildren(...this.configBarContent);
  }


  // ---- Static helpers ----
  static createSliderWrapper(className) {
    const node = document.createElement('div');
    node.classList.add(className);
    return node;
  }

  static createWidthSlider(target, max) {
    return new Slider89(target, {
      range: [1, max],
      value: 25,
      precision: 0,
      structure: `
        <thumb>
          <:value "$value" class=[slider-width-value]>
        </thumb>
      `
    });
  }
}
