import { UtilityWheel } from '@lib/utility-wheel/script/UtilityWheel.js';
import { UtilityWheelUIConfig } from '@lib/utility-wheel/script/UtilityWheelUIConfig.js';

import { canvasContainer, settingsActionList, settingsPanel } from '~/constants/misc.js';
import { ui } from '~/init.js';

/**
 * @typedef { import('@lib/utility-wheel/script/UtilityWheel.js').SectionCallback } SectionCallback
 * @typedef { import('@lib/utility-wheel/script/UtilityWheel.js').SectionSide } SectionSide
 */

const utilWheelTarget = /**@type HTMLElement*/ (document.getElementById('utility-wheel-target'));
const utilWheelConfig = /**@type HTMLElement*/ (settingsPanel.querySelector('.utility-wheel-container'));

/**
 * @typedef Action
 * @prop { { caption: string } } prompt
 * @prop { string } [shortTitle]
 * @prop { HTMLElement } button
 * @prop { Function } fn
 * @prop { SectionCallback } callback
 * @prop { HTMLElement } element
 */

export class UIActions {
  // @ts-ignore
  actions = /**@type { Record<string, Action> }*/({
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
  });

  /** @type UtilityWheelUIConfig */
  utilityWheel;

  constructor(callbacks) {
    // -- Add tools to actions --
    for (const toolButton of document.querySelectorAll('#toolbar > .button')) {
      const toolName = toolButton.dataset.tool;
      const title = 'Tool: ' + toolName.charAt(0).toUpperCase() + toolName.slice(1);

      this.actions[toolName] = {
        shortTitle: title,
        button: /**@type HTMLElement*/ (toolButton),
        fn: () => callbacks._tools(toolName)
      };
    }

    // -- Expand actions with callbacks and element --
    for (const [ actionName, action ] of Object.entries(this.actions)) {
      if (!actionName.startsWith('_')) {
        if (!action.fn) {
          this.actions[actionName].fn = callbacks[actionName];
        }
        this.actions[actionName].callback = this.callAction.bind(this, actionName);
        this.actions[actionName].element = UIActions.getActionElement(actionName, action);
      }
    }

    // -- Build and insert action list into settings --
    for (const { element } of Object.values(this.actions)) {
      settingsActionList.appendChild(element);
    }

    // -- Add event listeners to buttons --
    for (const [ actionName, action ] of Object.entries(this.actions)) {
      action.button.addEventListener('click', this.callAction.bind(this, actionName));
      action.button.addEventListener('dblclick', this.callAction.bind(this, actionName));
    }

    // -- Initialize UtilityWheel --
    this.utilityWheel = new UtilityWheelUIConfig(utilWheelTarget, {
      eventTarget: canvasContainer,
      actionList: Object.values(this.actions),
      configContainer: utilWheelConfig,
      replace: true,
    });

    this.utilityWheel.addEvent('invoke', this.utilWheelInvoke);
    this.utilityWheel.addEvent('hide', this.utilWheelHide);
    this.utilityWheel.addEvent('pointerUp', this.utilWheelUp);
    this.utilityWheel.addEvent('drop', this.utilWheelUserReassign);

    this.setUtilityWheelAction('top', 'copyRoomLink', true);
    this.setUtilityWheelAction('left', 'brush', true);
    this.setUtilityWheelAction('bottom', 'picker', true);
    this.setUtilityWheelAction('right', 'eraser', true);
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
  utilWheelUserReassign({ sectionSide, actionElem }) {
    localStorage.setItem(`Scratchet_UtilWheel_${sectionSide}`, actionElem.dataset.actionName);
  }
  utilWheelInvoke() {
    document.body.classList.add('active-utility-wheel');
  }
  utilWheelHide() {
    document.body.classList.remove('active-utility-wheel');
  }
  utilWheelUp(e) {
    ui.moveIndicator(e.x, e.y);
  }

  /**
   * @param { SectionSide } side
   * @param { string } actionName
   */
  setUtilityWheelAction(side, actionName, preferLocalStorage = false) {
    if (preferLocalStorage) {
      const key = `Scratchet_UtilWheel_${side}`;
      const item = localStorage.getItem(key);
      if (item) {
        if (!(item in this.actions)) {
          localStorage.removeItem(key);
        } else {
          actionName = item;
        }
      }
    }
    const action = this.actions[actionName];
    this.utilityWheel.setSection(side, action.element.cloneNode(true), action.callback);
  }

  /**
   * @param { string } name
   * @param { Object } action
   */
  static getActionElement(name, action) {
    const title = action.shortTitle || action.button.title;

    const wrapper = document.createElement('div');
    const tooltip = document.createElement('span');
    tooltip.classList.add('text');
    tooltip.textContent = title;
    const icon = action.button.querySelector('svg').cloneNode(true);

    wrapper.dataset.actionName = name;
    wrapper.classList.add('action-wrapper');
    wrapper.appendChild(tooltip);
    wrapper.appendChild(icon);

    return wrapper;
  }
}
