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
    this.addUserToUserList(CURRENT_USER_ID, defaultName, true);
    this.usernameInput.textContent = defaultName;
  }

  resetUsernameInput() {
    const prevUsername = this.usernameData.get(CURRENT_USER_ID).name;
    this.usernameInput.textContent = prevUsername;
    this.changeUsername(CURRENT_USER_ID, prevUsername);
  }

  // ---- Generic user handling ----
  changeUsername(userID, newUsername) {
    if (!this.usernameData.has(userID)) {
      this.addUserToUserList(userID, newUsername);
    }
    const nameData = this.usernameData.get(userID);
    nameData.name = newUsername;
    UsernameHandler.setListNodeContent(nameData.listNode, newUsername, userID === CURRENT_USER_ID);
  }

  addUserToUserList(userID, username = UsernameHandler.createDefaultName(userID), isOwnUser) {
    const listNode = UsernameHandler.createUserListNode(username, isOwnUser);
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
    return nameData.name;
  }

  updateUserIndicator() {
    this.userListButton.textContent = this.usernameData.size;
  }

  // ---- Static helper functions ----
  static createUserListNode(username, isOwnUser) {
    const listNode = document.createElement('span');
    listNode.classList.add('user');
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
