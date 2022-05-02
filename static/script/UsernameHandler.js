class UsernameHandler {
  usernameInput;
  userList;
  userListButton;

  usernameData = new Map();

  constructor(usernameInput, userList, userListButton) {
    this.usernameInput = usernameInput;
    this.userList = userList;
    this.userListButton = userListButton;

    const persistentUsername = localStorage.getItem(LOCALSTORAGE_USERNAME_KEY);
    if (persistentUsername) {
      this.initOwnUsername(persistentUsername);
    }
  }

  // ---- Events ----
  userListNodeHover(userID) {
    controller.highlightUser(userID);
  }
  userListNodeHoverLeave() {
    controller.activeRoom.redrawCanvas();
  }

  changeOwnUsername(newUsername) {
    if (/^[Uu]ser #\d+$/.test(newUsername)) {
      this.resetUsernameInput();
    } else if (newUsername !== this.usernameData.get(CURRENT_USER_ID).name) {
      this.changeUsername(CURRENT_USER_ID, newUsername);
      localStorage.setItem(LOCALSTORAGE_USERNAME_KEY, newUsername);
      sendMessage('changeName', newUsername);
    }
  }

  // ---- Own user handling ----
  initOwnUsername(username) {
    this.addUserToUserList(CURRENT_USER_ID, username, true);
    this.usernameInput.textContent = username;
  }

  resetUsernameInput() {
    localStorage.removeItem(LOCALSTORAGE_USERNAME_KEY);
    this.usernameInput.textContent = this.usernameData.get(CURRENT_USER_ID).name;
  }

  getOwnUsername() {
    return this.getUsername(CURRENT_USER_ID);
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
