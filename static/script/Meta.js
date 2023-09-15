const Meta = {
  // Length of additional metadata when received from the server
  EXTRA_SERVER_LEN: 2,
  // Metadata length of a payload of the specified mode, excluding the extra server metadata
  LEN: /** @type const */ ({
    BRUSH: 3,
    ERASE: 2
  }),
  FLAGS: /** @type const */ ({
    LAST_HUE: 0b0010,
    LAST_WIDTH: 0b0001
  }),


  // ---- Functions ----
  getReceivedServerMode(receivedServerDataWithMetadata) {
    return receivedServerDataWithMetadata[this.EXTRA_SERVER_LEN];
  },

  // Server data without extra server metadata
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
  }
}
