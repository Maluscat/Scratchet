export class ScratchetTool {
  /** @type { ScratchetTool | null } */
  static activeTool = null;

  static toolbar = document.getElementById('toolbar');
  static configBarWrapper = document.getElementById('tool-config-bar');
  static indicatorContainer = document.getElementById('indicator-container');

  buttonNode;
  configBarContent = [];
  indicator;
  name;

  constructor(toolName) {
    if (!toolName) {
      throw new Error("Tool name has not been passed!");
    }
    this.name = toolName;
    this.indicator = /**@type HTMLDivElement*/ (document.getElementById('indicator-' + toolName));
    this.buttonNode = /**@type HTMLButtonElement*/ (document.querySelector(`[data-tool="${toolName}"]`));
  }


  // ---- Activation handling ----
  activate() {
    ScratchetTool.activeTool = this;
    ScratchetTool.toolbar.querySelector('.active').classList.remove('active');
    this.buttonNode.classList.add('active');
    this.#activateIndicator();
    this.#populateConfigBar();
  }

  #activateIndicator() {
    const activeIndicator = ScratchetTool.indicatorContainer.querySelector('.active');
    if (activeIndicator && activeIndicator !== this.indicator) {
      activeIndicator.classList.remove('active');
    }
    this.indicator.classList.add('active');
  }

  // ---- Events (abstract) ----
  start() {}
  end() {}

  // ---- config bar ----
  #populateConfigBar() {
    ScratchetTool.configBarWrapper.replaceChildren(...this.configBarContent);
  }


  // ---- Static helpers ----
  /** @return { [ HTMLLabelElement, HTMLInputElement ] } */
  static createToggle(className, label) {
    const inputNode = document.createElement('input');
    const labelNode = document.createElement('label');

    inputNode.type = 'checkbox';
    inputNode.value = label;
    inputNode.classList.add(className);
    labelNode.classList.add('label');

    labelNode.appendChild(inputNode);
    labelNode.appendChild(document.createTextNode(label));
    return [ labelNode, inputNode ];
  }

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
      events: {
        'change:value': [
          ScratchetTool.setCSSStrokeWidth
        ]
      },
      structure: `
        <thumb>
          <:value "$value" class=[slider-width-value]>
        </thumb>
      `
    });
  }

  static setCSSStrokeWidth(slider) {
    document.documentElement.style.setProperty('--strokeWidth', slider.value + 'px');
  }
}
