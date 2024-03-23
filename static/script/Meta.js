// ---- Constants ----
/**
 * Time window in which a BULK_INIT may be sent from peers
 * after a user has joined.
 */
export const MAX_INIT_TRANSMISSION_TIME = 30 * 1000;
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
    return `hsla(${hue}, 75%, 70%, .1)`;
  } else {
    return `hsl(${hue}, 75%, 70%)`;
  }
}
