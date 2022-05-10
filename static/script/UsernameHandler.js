class UsernameHandler {
  usernameInput;
  userList;
  userListButton;

  usernameData = new Map();

  constructor(usernameInput, userList, userListButton, ownUsername, peers) {
    this.usernameInput = usernameInput;
    this.userList = userList;
    this.userListButton = userListButton;

    this.initOwnUsername(ownUsername);
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
  initOwnUsername(username) {
    this.addUserToUserList(CURRENT_USER_ID, username, true);
    this.usernameInput.textContent = username;
  }

  // ---- Generic user handling ----
  getUsername(userID) {
    if (this.usernameData.has(userID)) {
      return this.usernameData.get(userID).name;
    }
  }

  changeUsername(userID, newUsername) {
    if (!this.usernameData.has(userID)) {
      this.addUserToUserList(userID, newUsername);
    }
    const nameData = this.usernameData.get(userID);
    nameData.name = newUsername;
    UsernameHandler.setListNodeContent(nameData.listNode, newUsername, userID === CURRENT_USER_ID);
    return newUsername;
  }

  addUserToUserList(userID, username = UsernameHandler.createDefaultName(userID), isOwnUser) {
    const listNode = UsernameHandler.createUserListNode(username, isOwnUser);
    this.usernameData.set(userID, {
      name: username,
      listNode: listNode
    });
    listNode.addEventListener('mouseenter', this.userListNodeHover.bind(this, userID));
    listNode.addEventListener('mouseleave', this.userListNodeHoverLeave.bind(this));
    this.userList.appendChild(listNode);
    this.updateUserIndicator();
    return username;
  }
  removeUserFromUserList(userID) {
    if (!this.usernameData.has(userID)) {
      return UsernameHandler.createDefaultName(userID, true);
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
    this.userListButton.textContent = this.usernameData.size;
  }

  // ---- Static helper functions ----
  static createUserListNode(username, isOwnUser) {
    const listNode = document.createElement('span');
    listNode.classList.add('item');
    UsernameHandler.setListNodeContent(listNode, username, isOwnUser);
    return listNode;
  }

  static setListNodeContent(listNode, username, isOwnUser) {
    listNode.textContent = (isOwnUser ? username + ' (You)' : username);
  }

  static createDefaultName(userID, isUnknown) {
    return (isUnknown ? 'Unknown ' : '') + 'User #' + userID;
  }
}
