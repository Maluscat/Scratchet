// ---- Constants ----
export const MAX_USERNAME_LENGTH = 20;
// The additional 7 characters is the length of "'s room"
export const MAX_ROOM_NAME_LENGTH = MAX_USERNAME_LENGTH + 7;

export const JOINROOM_VALIDATE_REGEX = /^(?:(?:https?:\/\/)?\w+(?:\.\w+)*(?::\d{1,5})?(?:\/\w*?)*#)?(\d{4})$/iu;

// ---- Functions ----
export function validateAndReturnRoomCode(roomCode) {
  roomCode = parseInt(roomCode);
  if (!Number.isNaN(roomCode) && roomCode >= 1 && roomCode <= 9999) {
    return roomCode;
  }
  return false;
}

export function validateRoomInputValueToRoomCode(roomInputValue) {
  const match = roomInputValue.match(JOINROOM_VALIDATE_REGEX);
  return validateAndReturnRoomCode(match?.[1]);
}

export function validateRoomName(roomName) {
  if (!roomName || roomName.length > MAX_ROOM_NAME_LENGTH) {
    return false;
  }
  return true;
}

export function validateUsername(username) {
  if (!username || /^[Uu]ser #\d+$/.test(username) || username.length > MAX_USERNAME_LENGTH) {
    return false
  }
  return true;
}
