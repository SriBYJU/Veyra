/* Veyra publisher configuration.
   Spotify uses Authorization Code + PKCE, so the Client ID is public and no
   client secret belongs in this static site. Register https://sribyju.github.io/Veyra/
   as the redirect URI in the Spotify developer dashboard, then paste the
   Client ID below once for all Veyra users. Leave blank to keep Spotify
   gracefully unavailable without affecting any core Veyra feature. */
window.VEYRA_CONFIG = Object.freeze({
  spotifyClientId: 'efd754799ae94ffd853e61ef9a8ab5dc',
  // Cloudflare Worker URL from gateway/worker.js. Public lookup only; no personal Veyra history is sent.
  gatewayUrl: 'https://veyra-intelligence-gateway.avadhanula-shriyan.workers.dev'
});
