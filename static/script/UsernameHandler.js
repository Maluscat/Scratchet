'use strict';
/**
 * @typedef { import('./init.js') }
 */

/**
 * @typedef { object } nameData
 * @property { string } name
 * @property { HTMLSpanElement } listNode
 * @property { number } activeTimeout
 */

class UsernameHandler {
  userList;
  /**
   * @type { Map<number, nameData> }
   */
  usernameData = new Map();

  constructor(globalUsername, peers) {
    this.userList = UsernameHandler.createEmptyUserList();

    this.initGlobalUsername(globalUsername);
    for (const [userID, username] of peers) {
      this.addUserToUserList(userID, username);
    }
  }

  // ---- Events ----
  userListNodeHover(userID) {
    controller.highlightUser(userID);
  }
  userListNodeHoverLeave() {
    controller.activeRoom.redrawCanvas();
  }

  // ---- Own user handling ----
  initGlobalUsername(username) {
    this.addUserToUserList(CURRENT_USER_ID, username, true);
  }

  getOwnUsername() {
    return this.usernameData.get(CURRENT_USER_ID).name;
  }

  // ---- Generic user handling ----
  getUsername(userID) {
    if (this.hasUser(userID)) {
      return this.usernameData.get(userID).name;
    }
  }
  hasUser(userID) {
    return this.usernameData.has(userID);
  }

  changeUsername(userID, newUsername) {
    if (!this.hasUser(userID)) {
      this.addUserToUserList(userID, newUsername);
    }
    const nameData = this.usernameData.get(userID);
    nameData.name = newUsername;
    nameData.listNode.textContent = newUsername;
    return newUsername;
  }

  addUserToUserList(userID, username, isOwnUser) {
    const listNode = this.createUserListNode(username, isOwnUser, userID);
    this.usernameData.set(userID, {
      name: username,
      listNode: listNode
    });
    this.updateUserIndicator();
  }
  removeUserFromUserList(userID) {
    if (!this.hasUser(userID)) {
      return UsernameHandler.createUnknownDefaultName(userID);
    }
    const nameData = this.usernameData.get(userID);
    this.usernameData.delete(userID);
    nameData.listNode.remove();
    this.updateUserIndicator();
    return nameData.name;
  }

  setUserColorIndicator(userID, hue) {
    const nameData = this.usernameData.get(userID);
    nameData.listNode.style.color = makeHSLString(hue);

    if (nameData.activeTimeout != null) {
      clearTimeout(nameData.activeTimeout);
    }
    nameData.activeTimeout = setTimeout(() => {
      nameData.listNode.style.removeProperty('color');
      nameData.activeTimeout = null;
    }, SEND_INTERVAL * 1.5);
  }

  updateUserIndicator() {
    userListButton.textContent = this.usernameData.size;
  }

  // ---- Helper functions ----
  createUserListNode(username, isOwnUser, userID) {
    const listNode = document.createElement('span');
    listNode.classList.add('item');
    if (isOwnUser) {
      listNode.classList.add('current');
    }
    listNode.textContent = username;

    listNode.addEventListener('mouseenter', this.userListNodeHover.bind(this, userID));
    listNode.addEventListener('mouseleave', this.userListNodeHoverLeave.bind(this));

    this.userList.appendChild(listNode);
    return listNode;
  }

  setUsernameInput() {
    usernameInput.textContent = this.getOwnUsername();
  }

  appendUserList() {
    if (userListWrapper.childElementCount > 0) {
      userListWrapper.firstElementChild.remove();
    }
    userListWrapper.appendChild(this.userList);
  }

  // ---- Static helper functions ----
  static createEmptyUserList() {
    const userList = document.createElement('ul');
    userList.classList.add('user-list');
    return userList;
  }

  static createUnknownDefaultName(userID) {
    return 'Unknown User #' + userID;
  }
}
