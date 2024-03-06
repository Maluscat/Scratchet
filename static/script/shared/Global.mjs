// ---- Constants ----
export const MAX_INIT_TRANSMISSION_TIME = 30 * 1000;
export const SEND_INTERVAL = 40;
export const MODE = /** @type const */ ({
  BULK_INIT: -1,
  ERASE: -2,
  UNDO: -3,
  REDO: -4,
  HISTORY_MARKER: -5,
  BULK_INIT_BRUSH: -10,
  BULK_INIT_ERASE: -11,
  BULK_INIT_HISTORY_MARKER: -12,
});
