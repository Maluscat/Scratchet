const USERNAME_LEN = 20;

const Global = {
  MAX_INIT_TRANSMISSION_TIME: 30 * 1000,
  SEND_INTERVAL: 40,
  MODE: {
    BULK_INIT: -1,
    ERASE: -2,
    UNDO: -3,
    REDO: -4,
  },

  Validator: {
    MAX_USERNAME_LENGTH: USERNAME_LEN,
    // The additional 7 characters is the length of "'s room"
    MAX_ROOM_NAME_LENGTH: USERNAME_LEN + 7,

    JOINROOM_VALIDATE_REGEX: /^(?:(?:https?:\/\/)?\w+(?:\.\w+)*(?::\d{1,5})?(?:\/\w*?)*#)?(\d{4})$/,

    validateAndReturnRoomCode(roomCode) {
      roomCode = parseInt(roomCode);
      if (!Number.isNaN(roomCode) && roomCode >= 1 && roomCode <= 9999) {
        return roomCode;
      }
      return false;
    },

    validateRoomInputValueToRoomCode(roomInputValue) {
      const match = roomInputValue.match(Global.Validator.JOINROOM_VALIDATE_REGEX);
      return Global.Validator.validateAndReturnRoomCode(match?.[1]);
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
