// ---- Elements ----
export const canvasContainer = document.getElementById('canvas-container');

export const usernameInput = document.getElementById('username-input');
export const userListButton = document.getElementById('user-list-button');
export const userListWrapper = document.getElementById('user-list-wrapper');

export const roomNameInput = document.getElementById('roomcode-input');
export const roomListButton = document.getElementById('room-list-button');
export const roomList = document.getElementById('room-list');

export const joinRoomOverlayInput =
  /** @type HTMLInputElement */ (document.getElementById('join-room-overlay-input'));
export const copyRoomLinkOverlay = document.getElementById('copy-room-link-overlay');
export const copyRoomLinkContent = document.getElementById('copy-room-link-content');

// ---- Misc export constants ----
export const OVERLAY_INPUT_INVALID_DURATION = 365;
export const HIT_BORDER_DURATION = 200;

export const LOCALSTORAGE_USERNAME_KEY = 'Scratchet_username';
export const CURRENT_USER_ID = -1;

export const BULK_INIT_SEPARATOR_LEN = 2;
