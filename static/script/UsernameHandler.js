class UsernameHandler {
  usernameInput;
  userList;
  userListButton;

  userListNodes = new Map();
  defaultUsername;

  constructor(usernameInput, userList, userListButton) {
    this.usernameInput = usernameInput;
    this.userList = userList;
    this.userListButton = userListButton;
  }

  changeOwnUsername(newUsername) {
    if (/^[Uu]ser #\d+$/.test(newUsername)) {
      this.setOwnDefaultUsername();
    } else {
      this.changeUsername(CURRENT_USER_ID, newUsername);
      sendMessage('changeName', newUsername);
    }
  }

  setOwnDefaultUsername() {
    this.usernameInput.textContent = this.defaultUsername;
    this.changeUsername(CURRENT_USER_ID, this.defaultUsername);
  }

  changeUsername(userID, newUsername, listNode = this.userListNodes.get(userID)) {
    if (userID === CURRENT_USER_ID) {
      newUsername += ' (You)';
    }
    if (listNode.textContent !== newUsername) {
      listNode.textContent = newUsername;
    }
  }

  addUserToUsernameList(userID, username) {
    const listNode = UsernameHandler.createUserListNode();
    this.changeUsername(userID, username, listNode);
    this.userListNodes.set(userID, listNode);
    this.userList.appendChild(listNode);
    this.updateUserListButtonIndicator();
  }
  removeUserFromUsernameList(userID) {
    if (this.userListNodes.has(userID)) {
      this.userListNodes.get(userID).remove();
      this.userListNodes.delete(userID);
      this.updateUserListButtonIndicator();
    }
  }

  updateUserListButtonIndicator() {
    this.userListButton.textContent = this.userListNodes.size;
  }

  // ---- Static helper functions ----
  static createUserListNode(username) {
    const listNode = document.createElement('span');
    listNode.classList.add('user');
    return listNode;
  }
}
