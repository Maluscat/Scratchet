export default Validator = {
  JOINROOM_VALIDATE_REGEX: /^(?:(?:https?:\/\/)?\w+(?:\.\w+)*(?::\d{1,5})?(?:\/\w*?)*#)?(\d{4})$/,

  validateRoomCode(roomCode) {
    roomCode = parseInt(roomCode);
    if (!Number.isNaN(roomCode) && roomCode >= 1000 && roomCode <= 9999) {
      return true;
    }
    return false;
  },

  validateRoomInputValueToRoomCode(roomInputValue) {
    const match = roomInputValue.match(Validator.JOINROOM_VALIDATE_REGEX);
    if (match !== null && Validator.validateRoomCode(match[1])) {
      return parseInt(match[1]);
    }
    return false;
  },

  validateUsername(username) {
    if (!username || /^[Uu]ser #\d+$/.test(newUsername)) {
      return false
    }
    return true;
  }
};
