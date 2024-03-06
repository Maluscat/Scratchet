const Meta = {
  // ---- Constants ----
  // Length of additional metadata when received from the server
  EXTRA_SERVER_LEN: 2,
  // Metadata length of a payload of the specified mode, excluding the extra server metadata
  LEN: /** @type const */ ({
    BRUSH: 2,
    ERASE: 2
  }),


  // ---- Metadata functions ----
  getReceivedServerMode(receivedServerDataWithMetadata) {
    return receivedServerDataWithMetadata[this.EXTRA_SERVER_LEN];
  },
  // Server data without extra server metadata
  // NOTE: Any non-negative integer is the brush mode
  getPendingServerMode(pendingServerDataWithMetadata) {
    return pendingServerDataWithMetadata[0];
  },

  getClientHue(clientDataWithMetadata) {
    if (clientDataWithMetadata[0] >= 0) {
      return clientDataWithMetadata[0];
    }
    return false;
  },
  getClientWidth(clientDataWithMetadata) {
    // NOTE: This assumes that the width stays at position 1 in both normal & erase mode
    return clientDataWithMetadata[1];
  },

  // ---- Misc functions ----
  createPosDataWrapper(posData) {
    if (!posData) return [];
    return [ posData ];
  },

  makeHSLString(hue, hasReducedAlpha) {
    if (hasReducedAlpha) {
      return `hsla(${hue}, 75%, 70%, .1)`;
    } else {
      return `hsl(${hue}, 75%, 70%)`;
    }
  },
}
