# Veyra 3.4.1 — Publish Checklist

This file records the final state of the **master rebuild checklist** for the packaged candidate. It is not a replacement for the original 1,117-line source checklist; `REQUIREMENTS_AUDIT.md` maps the original sections.

## Release gate

- [x] Rebuild/fix performed before final audit.
- [x] Finite food/restaurant dead ends replaced by an open-ended resolver/fallback ladder.
- [x] Fixed recipe-library behavior removed as the primary pantry intelligence path.
- [x] Pantry-only mode enforces pantry-only required ingredients.
- [x] Voice/text/Coach/Add Food/Lens food paths converge on the final resolver.
- [x] Profile, target, distance-unit and pantry-preference state-loss issues fixed.
- [x] Active workout survives a page-refresh recovery path.
- [x] Nutrition-label serving size/custom-food flow fixed.
- [x] Activity screenshot pace/per-field-confidence handling fixed.
- [x] Replay checklist queries implemented.
- [x] Today timeline includes meals, activities, workouts and recovery context.
- [x] Saved meals/recipes/pantry editing/favorites/duplicates/undo/copy flows audited.
- [x] Exercise library includes filters, visuals, primary/secondary muscles and start/finish/form guidance.
- [x] No explicit under-18 feature gate remains; maintenance-oriented starter estimates use the same optional input requirements for every profile.
- [x] PWA/SEO/service worker/static assets audited.
- [x] Browser Compatibility section names Chrome, Edge, Safari and Firefox and explains API-dependent fallbacks.
- [x] Safari barcode path does not require native BarcodeDetector; pinned ZXing fallback retries rotation/contrast/inversion passes before typed-code fallback.
- [x] Daily nutrition date key uses the user device/browser local calendar day rather than UTC rollover.
- [x] No fake watch integration, no fake Spotify connected state, no private secrets.
- [x] Competitor comparison rerun and meaningful gaps addressed where realistic.
- [x] Full 3.4.0 audited baseline passed **328 / 328** browser/integration checks; 3.4.1 final-change delta passed **29 / 29** deterministic checks.
- [x] Static code/manifest/sitemap/asset audit passes on frozen worktree.
- [x] Exact 3.4.1 verification ZIP validation — extracted files passed the 29 / 29 final-change suite, JavaScript syntax, manifest/sitemap, local-asset/service-worker checks and ZIP integrity.

## Deployment-dependent activation / spot-checks

These are not missing fake buttons; they are real external conditions that cannot be permanently certified by a static ZIP:

- [ ] Open the deployed GitHub Pages URL on a physical phone and grant camera permission for a live camera capture spot-check.
- [ ] Grant microphone permission on a supported browser for a live speech-recognition spot-check (typed fallback is already tested).
- [ ] Try one live third-party public food/restaurant lookup after deployment to confirm the external services are reachable from the user's network/browser.
- [ ] Configure Spotify only if desired: register the deployed redirect URI and set the public Client ID in `config.js`.
- [ ] Deploy the optional lookup-only gateway only if the owner wants that extra reliability/control; core public-source/manual flows do not require it.

## Release status

**Code/package status: validated publish candidate.**  
The packaged candidate was extracted and rerun through the complete automated/static suite successfully. Physical-device/external-service spot-checks remain environment-dependent and should never be represented as guaranteed by the ZIP itself.
