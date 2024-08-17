// ---- Constants ----
/**
 * Amount of milliseconds a disconnected user can still
 * reconnect and restore its points in.
 */
export const USER_DEACTIVATION_TIMEOUT = 1000 * 60 * 5;
/**
 * Amount of milliseconds after which a timed out user will be viewed
 * as disconnected. {@link USER_DEACTIVATION_TIMEOUT} still applies.
 */
export const TIMED_OUT_USER_DISCONNECT_TIMEOUT = 1000 * 60;

/** Interval in milliseconds how often the payload is sent to the server. */
export const SEND_INTERVAL = 40;
/** The first byte of a (pending) server payload that demoninates its mode. */
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

/** Additional metadata length that the server adds when sending it. */
export const EXTRA_SERVER_LEN = 2;
/**
 * Metadata length of a payload of the specified mode,
 * excluding the extra server metadata.
 */
export const LEN = /** @type const */ ({
  BRUSH: 2,
  ERASE: 2
});


// ---- Metadata functions ----
export function getReceivedServerMode(receivedServerDataWithMetadata) {
  return receivedServerDataWithMetadata[this.EXTRA_SERVER_LEN];
}
// Server data without extra server metadata
// NOTE: Any non-negative integer is the brush mode
export function getPendingServerMode(pendingServerDataWithMetadata) {
  return pendingServerDataWithMetadata[0];
}

export function getClientHue(clientDataWithMetadata) {
  if (clientDataWithMetadata[0] >= 0) {
    return clientDataWithMetadata[0];
  }
  return false;
}
export function getClientWidth(clientDataWithMetadata) {
  // NOTE: This assumes that the width stays at position 1 in both normal & erase mode
  return clientDataWithMetadata[1];
}

// ---- Misc functions ----
export function createPosDataWrapper(posData) {
  if (!posData) return [];
  return [ posData ];
}

export function makeHSLString(hue, hasReducedAlpha) {
  if (hasReducedAlpha) {
    return `hsla(${hue}, 75%, 67.5%, .1)`;
  } else {
    return `hsl(${hue}, 75%, 67.5%)`;
  }
}

/** Adapted from https://stackoverflow.com/a/32423075/23408487 */
/**
 * @param { number } r
 * @param { number } g
 * @param { number } b
 * @return number
 */
export function getHueFromRGB(r, g, b) {
  let hue = 0;
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b);

  if (max === min) return 0;

  if (max === r) {
    hue = 0 + (g - b) / (max - min);
  } else if (max === g) {
    hue = 2 + (b - r) / (max - min);
  } else if (max === b) {
    hue = 4 + (r - g) / (max - min);
  }

  hue *= 60;
  hue %= 360;
  if (hue < 0){
    hue += 360;
  }

  return Math.round(hue);
}
