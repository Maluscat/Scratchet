class ScratchetTool {
  buttonNode;


  constructor(toolName) {
    if (!toolName) {
      throw new Error('No tool name has been passed!');
    }

    this.buttonNode = document.querySelector(`[data-tool="${toolName}"]`);
  }


  activate() {
    this.buttonNode.classList.add('active');
  }
  deactivate() {
    this.buttonNode.classList.remove('active');
  }
}
