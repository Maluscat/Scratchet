// ---- Constants ----
// Length of additional metadata when received from the server
export const EXTRA_SERVER_LEN = 2;
// Metadata length of a payload of the specified mode, excluding the extra server metadata
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
