import {
  MAX_PERCEIVED_TIMEOUT_PINGS,
  CURRENT_USER_ID,
  canvasContainer,
  roomNameInput,
  usernameInput,
  userListWrapper,
} from '~/constants/misc.js';
import { USER_DEACTIVATION_TIMEOUT } from '~/constants/meta.js';
import { RoomController } from '~/room/RoomController.js';
import { UserBulkInit } from '~/user/UserBulkInit.js';
import { Brush } from '~/tool/Brush.js';
import { Eraser } from '~/tool/Eraser.js';
import { ui, controls3D } from '~/init.js';

/** @typedef { import('~/user/User.js').User } User */

export class Room extends RoomController {
  static canvasZIndex = 1;

  nameHandler;
  roomListNode;
  roomCodeLink;

  /** @type number */
  roomCode;
  /** @type string */
  roomName;

  // /** @type { WeakMap<UserBulkInit, number> } */
  // timedOutUsers = new Map();
  /** @type { Map<number, UserBulkInit> } */
  users = new Map();
  userListNode;

  constructor(roomCode, roomName, globalUsername, peers) {
    super(Room.createCanvas(), roomCode, globalUsername);
    this.handleReceivedPing = this.handleReceivedPing.bind(this);

    // Set active tool by current active class
    for (const tool of Object.values(this.tools)) {
      if (tool.buttonNode.classList.contains('active')) {
        this.#setActiveTool(tool);
      }
    }

    this.roomCode = roomCode;

    this.userListNode = Room.createEmptyUserList();
    this.roomListNode = Room.createRoomListNode();
    this.roomCodeLink = Room.createRoomCodeLink(roomCode);

    this.#addUserObject(CURRENT_USER_ID, this.ownUser);
    for (const [ userID, username ] of peers) {
      this.addUser(userID, username);
    }

    this.changeRoomName(roomName);
  }

  handleUserTimeout(userID) {
    const user = this.getUser(userID);
    user.deactivate();
  }
  handleUserReconnect(userID) {
    const user = this.getUser(userID);
    const inactiveCount = MAX_PERCEIVED_TIMEOUT_PINGS + user.inactivePingCount;
    user.activate();

    // If the (running) intact counter exceeds the timed out time,
    // no group has been added in the time.
    if (this.ownUser.historyHandler.intactCounter <= inactiveCount) {
      const groupIndex = this.ownUser.historyHandler.getLastIntactGroupIndex(inactiveCount);
      if (groupIndex != false) {
        this.sendBulkInitBuffer(groupIndex);
      }
    }
  }

  handleReceivedPing() {
    for (const user of this.users.values()) {
      if (user.active) {
        user.historyHandler.markIntact();
      } else {
        user.inactivePingCount++;
      }
    }
  }

  // ---- Tool handling ----
  activateTool(toolName) {
    const tool = this.tools[toolName];
    if (this.activeTool !== tool) {
      this.#setActiveTool(tool);
    }
  }

  #setActiveTool(tool) {
    this.activeTool = tool;
    this.activeTool.activate();
  }

  scrollAction(e, direction) {
    switch (this.activeTool.constructor) {
      case Brush: {
        if (e.shiftKey) {
          /** @type { Brush } */ (this.activeTool).hue += direction * 24;
        } else if (!e.ctrlKey) {
          /** @type { Brush } */ (this.activeTool).width += direction * 7;
        }
        break;
      }
      case Eraser: {
        if (e.shiftKey) {
          /** @type { Eraser } */ (this.activeTool).width += direction * 21;
        } else if (!e.ctrlKey) {
          /** @type { Eraser } */ (this.activeTool).width += direction * 7;
        }
        break;
      }
    }
  }


  // ---- User handling ----
  /**
   * @param { number } userID
   * @return { UserBulkInit }
   */
  getUser(userID) {
    return this.users.get(userID);
  }
  /**
   * @param { number } userID
   * @return { boolean }
   */
  hasUser(userID) {
    return this.users.has(userID);
  }

  addUser(userID, username) {
    const user = new UserBulkInit(username, this.posHandler);
    this.#addUserObject(userID, user);
  }
  removeUser(userID) {
    if (!this.hasUser(userID)) {
      throw new Error(`@ removeUser: User #${userID} does not exist`);
    }
    const user = this.getUser(userID);
    this.users.delete(userID);

    this.clearUserBufferAndRedraw(user);

    this.userListNode.removeChild(user.listNode);
    this.updateUserIndicator();

    return user;
  }

  /**
   * @param { number } userID
   * @param { UserBulkInit } user
   */
  #addUserObject(userID, user) {
    this.users.set(userID, user);
    this.userListNode.appendChild(user.listNode);
    this.updateUserIndicator();

    this.sendBulkInitBuffer();
  }

  // ---- User UI helpers ----
  setUsernameInput() {
    usernameInput.textContent = this.ownUser.name;
  }

  updateUserIndicator() {
    ui.setUserIndicator(this.users.size);
  }
  appendUserList() {
    if (userListWrapper.childElementCount > 0) {
      userListWrapper.firstElementChild.remove();
    }
    userListWrapper.appendChild(this.userListNode);
    this.updateUserIndicator();
  }

  // ---- Generic room handling ----
  changeRoomName(roomName) {
    if (roomName !== this.roomName) {
      this.roomName = roomName;
      this.roomListNode.textContent = roomName;
      this.setRoomNameInput();
    }
  }

  focus() {
    controls3D.changeState(this.view.state);
    controls3D.changeEventTarget(this.view.canvas);

    this.displayCanvas();
    this.roomListNode.classList.add('current');

    this.setRoomNameInput();
    this.view.canvas.style.zIndex = Room.canvasZIndex++;

    this.view.updateScaleSlider();
    this.activeTool.activate();

    this.sendHandler.activateTimers();
  }
  unfocus() {
    controls3D.changeState(null);

    this.sendHandler.clearTimers();

    this.view.canvas.classList.add('inactive');
    this.roomListNode.classList.remove('current');
  }

  displayCanvas() {
    this.view.canvas.classList.remove('inactive');
  }

  async removeSelf() {
    await this.removeCanvas();
    this.unfocus();
    this.roomListNode.remove();
    this.userListNode.remove();
  }

  // ---- Room UI helpers ----
  removeCanvas() {
    return new Promise(resolve => {
      this.view.canvas.classList.add('remove');
      setTimeout(() => {
        this.view.canvas.remove();
        resolve();
      }, ui.getCanvasAnimDurationRemove());
    });
  }

  setRoomNameInput() {
    roomNameInput.textContent = this.roomName;
  }

  // ---- Static helper functions ----
  static createEmptyUserList() {
    const userList = document.createElement('ul');
    userList.classList.add('user-list');
    return userList;
  }

  static createRoomListNode() {
    const listNode = document.createElement('span');
    listNode.classList.add('item');
    return listNode;
  }

  static createRoomCodeLink(roomCode) {
    return `${location.origin + location.pathname}#${roomCode.toString().padStart(4, 0)}`;
  }

  static createCanvas() {
    const canvas = document.createElement('canvas');
    canvasContainer.appendChild(canvas);
    return canvas;
  }
}
