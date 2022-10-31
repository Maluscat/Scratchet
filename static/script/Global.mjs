const USERNAME_LEN = 20;

const Global = {
  SEND_INTERVAL: 40,
  MODE: {
    BULK_INIT: -1,
    ERASE: -2,
  },

  Validator: {
    MAX_USERNAME_LENGTH: USERNAME_LEN,
    // The additional 7 characters is the length of "'s room"
    MAX_ROOM_NAME_LENGTH: USERNAME_LEN + 7,

    JOINROOM_VALIDATE_REGEX: /^(?:(?:https?:\/\/)?\w+(?:\.\w+)*(?::\d{1,5})?(?:\/\w*?)*#)?(\d{4})$/,

    validateRoomCode(roomCode) {
      roomCode = parseInt(roomCode);
      if (!Number.isNaN(roomCode) && roomCode >= 1000 && roomCode <= 9999) {
        return true;
      }
      return false;
    },

    validateRoomInputValueToRoomCode(roomInputValue) {
      const match = roomInputValue.match(Global.Validator.JOINROOM_VALIDATE_REGEX);
      if (match !== null && Global.Validator.validateRoomCode(match[1])) {
        return parseInt(match[1]);
      }
      return false;
    },

    validateRoomName(roomName) {
      if (!roomName || roomName.length > Global.Validator.MAX_ROOM_NAME_LENGTH) {
        return false;
      }
      return true;
    },

    validateUsername(username) {
      if (!username || /^[Uu]ser #\d+$/.test(username) || username.length > Global.Validator.MAX_USERNAME_LENGTH) {
        return false
      }
      return true;
    }
  }
};
export default Global;
