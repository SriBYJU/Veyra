# Veyra Intelligence Gateway (optional)

`worker.js` is a lookup-only Cloudflare Worker companion for Veyra. The GitHub Pages app works without it using keyless public data sources directly; deploying the Worker improves CORS/reliability and creates the server-side boundary described in Veyra's methodology.

The Worker receives only a food query or public webpage URL. It does **not** receive the user's Veyra profile, nutrition history, workouts, sleep, pantry, or Vault.

Default deployment needs no third-party API key. It uses Open Food Facts plus USDA FoodData Central's public `DEMO_KEY`. For higher USDA quota, set `FDC_API_KEY` as a Worker secret. Never commit secrets to the repository.

After deploying, set `gatewayUrl` in `config.js` to the Worker's public HTTPS URL. Leaving it blank is supported and keeps the zero-setup direct-public-source fallback.
