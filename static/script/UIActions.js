'use strict';
class UIActions {
  actions = {
    leaveRoom: {
      prompt: {
        caption: 'Leave the current room?'
      },
      shortTitle: 'Leave room',
      button: document.getElementById('leave-room-button')
    },
    copyRoomLink: {
      button: document.getElementById('copy-room-link-button')
    },
    createRoom: {
      shortTitle: 'Create empty room',
      button: document.getElementById('new-room-button')
    },
    joinRoom: {
      shortTitle: 'Join room',
      button: document.getElementById('join-room-button')
    },
    clear: {
      prompt: {
        caption: 'Clear your drawing?'
      },
      shortTitle: 'Clear drawing',
      button: document.getElementById('clear-drawing-button')
    },
    undo: {
      shortTitle: 'Undo',
      button: document.getElementById('undo-button')
    },
    redo: {
      shortTitle: 'Redo',
      button: document.getElementById('redo-button')
    }
  };

  utilityWheel;

  constructor(callbacks) {
    // Add tools to actions
    for (const toolButton of document.querySelectorAll('#toolbar > .button')) {
      const toolName = toolButton.dataset.tool;
      const title = 'Tool: ' + toolName.charAt(0).toUpperCase() + toolName.slice(1);

      this.actions[toolName] = {
        shortTitle: title,
        button: toolButton,
        fn: () => callbacks._tools(toolName)
      };
    }

    // Add event callbacks
    for (const [ actionName, callback ] of Object.entries(callbacks)) {
      if (!actionName.startsWith('_')) {
        this.actions[actionName].fn = callback;
      }
    }

    // Add event listeners to buttons
    for (const [ actionName, action ] of Object.entries(this.actions)) {
      action.button.addEventListener('click', this.callAction.bind(this, actionName));
      action.button.addEventListener('dblclick', this.callAction.bind(this, actionName));
    }

    this.utilityWheel = new UtilityWheel(document.querySelector('body > .utility-wheel'), {
      target: canvasContainer
    });

    this.utilityWheel.addEvent('invoke', this.utilWheelInvoke);
    this.utilityWheel.addEvent('hide', this.utilWheelHide);
    this.utilityWheel.addEvent('pointerUp', this.utilWheelUp);

    this.setUtilityWheelAction('top', 'copyRoomLink');
    this.setUtilityWheelAction('left', 'brush');
    this.setUtilityWheelAction('bottom', 'clear');
    this.setUtilityWheelAction('right', 'eraser');
  }

  // ---- Action handling ----
  callAction(actionName, e) {
    const action = this.actions[actionName];
    if (action.prompt && (!e || e.type !== 'dblclick' && !e.shiftKey && !e.ctrlKey)) {
      ui.dispatchPrompt(action.prompt.caption, action.fn);
    } else if (!e || e.type !== 'dblclick' || action.prompt) {
      ui.removePrompt();
      action.fn();
    }
  }

  // ---- Utility wheel handling ----
  utilWheelInvoke() {
    document.body.classList.add('active-utility-wheel');
  }
  utilWheelHide() {
    document.body.classList.remove('active-utility-wheel');
  }
  utilWheelUp(e) {
    ui.moveDrawIndicator(e.x, e.y);
  }

  /**
   * @param { SectionSide } side
   * @param { string } actionName
   */
  setUtilityWheelAction(side, actionName) {
    const action = this.actions[actionName];
    const sectionElement = this.createUtilityWheelSectionElement(side, action);
    this.utilityWheel.setSection(side, sectionElement, this.callAction.bind(this, actionName));
  }

  /**
   * @param { SectionSide } side
   * @param { Object } action
   */
  createUtilityWheelSectionElement(side, action) {
    const title = action.shortTitle || action.button.title;

    const wrapper = document.createElement('div');
    const tooltip = document.createTextNode(title);
    const icon = action.button.querySelector('svg').cloneNode(true);

    wrapper.classList.add('wrapper');
    wrapper.appendChild(tooltip);
    wrapper.appendChild(icon);

    return wrapper;
  }
}
