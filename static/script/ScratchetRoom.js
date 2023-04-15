'use strict';
class ScratchetRoom extends ScratchetCanvas {
  static canvasZIndex = 1;

  nameHandler;
  roomListNode;
  roomCodeLink;

  roomCode;
  roomName;

  /** @type { Map<number, ScratchetUser> } */
  users = new Map();
  userListNode;

  constructor(roomCode, roomName, globalUsername, peers) {
    const ownUser = new ScratchetUser(CURRENT_USER_ID, globalUsername);

    super(ScratchetRoom.createCanvas(), ownUser);

    // Set active tool by current active class
    for (const tool of Object.values(this.tools)) {
      if (tool.buttonNode.classList.contains('active')) {
        this.#setActiveTool(tool);
      }
    }

    this.roomCode = roomCode;

    this.userListNode = ScratchetRoom.createEmptyUserList();
    this.roomListNode = ScratchetRoom.createRoomListNode();
    this.roomCodeLink = ScratchetRoom.createRoomCodeLink(roomCode);

    this.#addUserObject(ownUser);
    for (const [ userID, username ] of peers) {
      this.addUser(userID, username);
    }

    this.changeRoomName(roomName);
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
   * @return { ScratchetUser }
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
    const user = new ScratchetUser(userID, username);
    this.#addUserObject(user);
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

  #addUserObject(user) {
    this.users.set(user.userID, user);
    this.userListNode.appendChild(user.listNode);
    this.updateUserIndicator();

    this.sendJoinedUserBuffer();
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
    controls3D.changeState(this.state);
    controls3D.changeEventTarget(this.canvas);

    this.displayCanvas();
    this.roomListNode.classList.add('current');

    this.setRoomNameInput();
    this.canvas.style.zIndex = ScratchetRoom.canvasZIndex++;

    this.updateScaleSlider();

    this.activeTool.activate();
  }
  unfocus() {
    controls3D.changeState(null);

    this.canvas.classList.add('inactive');
    this.roomListNode.classList.remove('current');
  }

  displayCanvas() {
    this.canvas.classList.remove('inactive');
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
      this.canvas.classList.add('remove');
      setTimeout(() => {
        this.canvas.remove();
        resolve();
      }, getCanvasAnimDurationRemove());
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
    return `${location.href}#${roomCode}`;
  }

  static createCanvas() {
    const canvas = document.createElement('canvas');
    canvasContainer.appendChild(canvas);
    return canvas;
  }
}
