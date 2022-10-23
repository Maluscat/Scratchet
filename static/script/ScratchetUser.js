'use strict';
class ScratchetUser {
  userID;
  name;
  posCache;

  listNode;
  activeTimeout;

  constructor(username, userID) {
    this.userID = userID;
    this.name = username;
    this.posCache = new Set();
    this.listNode = this.createUserListNode(username, userID === CURRENT_USER_ID);
  }

  setName(newUsername) {
    this.name = newUsername;
    this.listNode.textContent = newUsername;
  }

  setColorIndicator(hue) {
    this.listNode.style.color = makeHSLString(hue);

    if (this.activeTimeout != null) {
      clearTimeout(this.activeTimeout);
    }
    this.activeTimeout = setTimeout(() => {
      this.listNode.style.removeProperty('color');
      this.activeTimeout = null;
    }, SEND_INTERVAL * 1.5);
  }

  // ---- Events ----
  listNodeMouseEnter() {
    controller.highlightUser(this.userID);
  }
  listNodeMouseLeave() {
    controller.activeRoom.redrawCanvas();
  }

  // ---- Helper functions ----
  createUserListNode(username, isOwnUser) {
    const listNode = document.createElement('span');
    listNode.classList.add('item');
    if (isOwnUser) {
      listNode.classList.add('current');
    }
    listNode.textContent = username;

    listNode.addEventListener('mouseenter', this.listNodeMouseEnter.bind(this));
    listNode.addEventListener('mouseleave', this.listNodeMouseLeave.bind(this));

    return listNode;
  }
}
