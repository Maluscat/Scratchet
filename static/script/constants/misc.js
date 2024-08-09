// ---- Elements ----
export const canvasContainer = /**@type HTMLCanvasElement*/ (document.getElementById('canvas-container'));

export const usernameInput = /**@type HTMLInputElement*/ (document.getElementById('username-input'));
export const userListButton = /**@type HTMLButtonElement*/ (document.getElementById('user-list-button'));
export const userListWrapper = /**@type HTMLDivElement*/ (document.getElementById('user-list-wrapper'));

export const roomNameInput = /**@type HTMLInputElement*/ (document.getElementById('roomcode-input'));
export const roomListButton = /**@type HTMLButtonElement*/ (document.getElementById('room-list-button'));
export const roomList = /**@type HTMLUListElement*/ (document.getElementById('room-list'));

export const joinRoomOverlayInput = /**@type HTMLInputElement*/ (document.getElementById('join-room-overlay-input'));
export const copyRoomLinkOverlay = /**@type HTMLDivElement*/ (document.getElementById('copy-room-link-overlay'));
export const copyRoomLinkContent = /**@type HTMLDivElement*/ (document.getElementById('copy-room-link-content'));

export const settingsButton = /**@type HTMLButtonElement*/ (document.getElementById('settings-button'));
export const settingsPanel = /**@type HTMLDivElement*/ (document.getElementById('settings-panel'));

// ---- Misc export constants ----
/** How many ping windows are required at max for a timeout to be perceived. */
export const MAX_PERCEIVED_TIMEOUT_PINGS = 3;

export const OVERLAY_INPUT_INVALID_DURATION = 365;
export const HIT_BORDER_DURATION = 200;

export const LOCALSTORAGE_USERNAME_KEY = 'Scratchet_username';
export const CURRENT_USER_ID = -1;

export const BULK_INIT_SEPARATOR_LEN = 2;
