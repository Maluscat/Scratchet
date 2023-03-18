'use strict';
class UIActions {
  actions = {
    leaveRoom: {
      prompt: {
        caption: 'Leave the current room?'
      },
      button: document.getElementById('leave-room-button')
    },
    copyRoomLink: {
      button: document.getElementById('copy-room-link-button')
    },
    createRoom: {
      button: document.getElementById('new-room-button')
    },
    joinRoom: {
      button: document.getElementById('join-room-button')
    },
    clear: {
      prompt: {
        caption: 'Clear your drawing?'
      },
      button: document.getElementById('clear-drawing-button')
    }
  };

  constructor(callbacks) {
    // Add tools to actions
    for (const toolButton of document.querySelectorAll('#toolbar > .button')) {
      const toolName = toolButton.dataset.tool;
      this.actions[toolName] = {
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
  }

  callAction(actionName, e) {
    const action = this.actions[actionName];
    if (action.prompt && (!e || e.type !== 'dblclick' && !e.shiftKey)) {
      ui.dispatchPrompt(action.prompt.caption, action.fn);
    } else {
      ui.removePrompt();
      action.fn();
    }
  }
}
