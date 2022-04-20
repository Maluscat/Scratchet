class UsernameHandler {
  usernameInput;
  userList;
  userListButton;

  userListNodes = new Map();

  constructor(usernameInput, userList, userListButton) {
    this.usernameInput = usernameInput;
    this.userList = userList;
    this.userListButton = userListButton;
  }

  // ---- Events ----
  changeOwnUsername(newUsername) {
    if (/^[Uu]ser #\d+$/.test(newUsername)) {
      this.resetUsernameInput();
    } else {
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
      defaultUsername = this.userListNodes.get(CURRENT_USER_ID).textContent;
    }
    this.usernameInput.textContent = defaultUsername;
    this.changeUsername(CURRENT_USER_ID, defaultUsername);
  }

  // ---- Generic user handling ----
  changeUsername(userID, newUsername, listNode = this.userListNodes.get(userID)) {
    if (listNode) {
      if (userID === CURRENT_USER_ID) {
        newUsername += ' (You)';
      }
      if (listNode.textContent !== newUsername) {
        listNode.textContent = newUsername;
      }
    }
  }

  addUserToUserList(userID, username = UsernameHandler.createDefaultName(userID)) {
    const listNode = UsernameHandler.createUserListNode();
    this.changeUsername(userID, username, listNode);
    this.userListNodes.set(userID, listNode);
    this.userList.appendChild(listNode);
    this.updateUserIndicator();
  }
  removeUserFromUserList(userID) {
    if (this.userListNodes.has(userID)) {
      this.userListNodes.get(userID).remove();
      this.userListNodes.delete(userID);
      this.updateUserIndicator();
    }
  }

  updateUserIndicator() {
    this.userListButton.textContent = this.userListNodes.size;
  }

  // ---- Static helper functions ----
  static createUserListNode(username) {
    const listNode = document.createElement('span');
    listNode.classList.add('user');
    return listNode;
  }

  static createDefaultName(userID) {
    return 'User #' + userID;
  }
}
