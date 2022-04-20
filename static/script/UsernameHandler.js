class UsernameHandler {
  usernameInput;
  userList;
  userListButton;

  usernameData = new Map();

  constructor(usernameInput, userList, userListButton) {
    this.usernameInput = usernameInput;
    this.userList = userList;
    this.userListButton = userListButton;
  }

  // ---- Events ----
  changeOwnUsername(newUsername) {
    if (/^[Uu]ser #\d+$/.test(newUsername)) {
      this.resetUsernameInput();
    } else if (newUsername !== this.usernameData.get(CURRENT_USER_ID).name) {
      this.changeUsername(CURRENT_USER_ID, newUsername);
      sendMessage('changeName', newUsername);
    }
  }

  // ---- Own user handling ----
  initOwnUsernameFromRealID(realUserID) {
    const defaultName = UsernameHandler.createDefaultName(realUserID);
    this.addUserToUserList(CURRENT_USER_ID, defaultName);
    this.resetUsernameInput(defaultName);
  }

  resetUsernameInput(defaultUsername) {
    if (!defaultUsername) {
      defaultUsername = this.usernameData.get(CURRENT_USER_ID).name;
    }
    this.usernameInput.textContent = defaultUsername;
    this.changeUsername(CURRENT_USER_ID, defaultUsername);
  }

  // ---- Generic user handling ----
  changeUsername(userID, newUsername) {
    if (!this.usernameData.has(userID)) {
      this.addUserToUserList(userID, newUsername);
    }
    const nameData = this.usernameData.get(userID);
    nameData.name = newUsername;
    nameData.listNode.textContent = (userID === CURRENT_USER_ID ? newUsername + ' (You)' : newUsername);
  }

  addUserToUserList(userID, username = UsernameHandler.createDefaultName(userID)) {
    const listNode = UsernameHandler.createUserListNode(username);
    this.usernameData.set(userID, {
      name: username,
      listNode: listNode
    });
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
  }

  updateUserIndicator() {
    this.userListButton.textContent = this.usernameData.size;
  }

  // ---- Static helper functions ----
  static createUserListNode(username) {
    const listNode = document.createElement('span');
    listNode.classList.add('user');
    listNode.textContent = username;
    return listNode;
  }

  static createDefaultName(userID, isUnknown) {
    return (isUnknown ? 'Unknown ' : '') + 'User #' + userID;
  }
}
