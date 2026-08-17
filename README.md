# Veyra 3.4.1 — Publish Candidate

Veyra is a phone-first, local-first fitness and nutrition PWA designed for static hosting at `https://sribyju.github.io/Veyra/`. Version 3.4.1 replaces the remaining catalog-like food and recipe behavior with open-ended resolution, adds the full audit fixes found during the master rebuild, and keeps the core experience usable without an account or private backend.

## What 3.4.1 changes

### Open-ended food resolution
Veyra no longer treats a finite JavaScript food list as the end of the road. A user-entered food can move through this review-first ladder:

1. local custom foods / learned Veyra history;
2. Open Food Facts public product search;
3. USDA FoodData Central public fallback;
4. optional lookup-only Veyra Intelligence Gateway when a deployment URL is configured;
5. for named restaurants, official-site discovery through Wikidata plus public-page reading through the keyless Jina Reader path;
6. transparent generic-dish or ingredient-composition estimate;
7. nutrition-label, published-value or manual review fallback.

Restaurant identity is deliberately strict. A nutritionally similar public item is not presented as restaurant-verified just because one word overlaps with the restaurant name. Quantities, sizes and customizations are preserved into review, and exact-looking numbers are not silently invented when a source cannot verify them.

### Dynamic pantry recipes
The preset `recipeLibrary()` remains only as compatibility/reference content; it is not the primary intelligence path. Pantry recipes are procedurally constructed from the ingredients actually present in the user's pantry. In **Use only my pantry** mode, every required ingredient must come from the pantry. Optional extras are separate and can be added to the shopping list. The engine supports cuisine, diet/restrictions, protein, calories, cooking time, equipment, meal type and difficulty constraints and explains when a combination cannot be met honestly.

### Training and exercise library
Veyra Live supports weighted, bodyweight, timed and distance work, RPE, set types, rest timers, per-exercise rest, supersets, substitutions, notes, previous values, active-workout refresh recovery and progress analytics. The standalone Exercise Library is searchable and filterable by muscle/equipment and exposes a visual, primary/secondary muscles, equipment, start/finish guidance and a concise form cue. Equipment categories include barbell, dumbbells, cables, machines, bodyweight, resistance bands, cardio equipment and outdoor activity.

### Profile, Vault and age-neutral starter targets
The six-step setup keeps a clean first-run state with no fake meals, workouts, streaks, sleep or targets. Body/volume units (`lb/in/oz` vs `kg/cm/mL`) and distance units (`mi` vs `km`) are independent. Pantry recipe preference is persistent. Veyra Vault restores the complete local state and rejects malformed imports. Maintenance-oriented starter nutrition estimates are available whenever the optional age/height/weight/activity/calculation inputs are present; age does not unlock or restrict Veyra features. Every generated starter target remains editable and optional.

### Lens, barcode and activity import
Veyra Lens uses browser-side vision/OCR paths with mandatory review. Meal photos can produce multiple editable candidates; pantry photos produce editable ingredient candidates; nutrition-label scans preserve serving size and supported nutrients and can save a reusable custom food. Activity screenshots preserve parsed fields such as duration, distance, pace, steps and visible calories with confidence. Barcode images use native `BarcodeDetector` when available and a pinned ZXing browser fallback when loaded.

### Replay, Lab and Nexus
Replay interprets natural-language history questions such as yesterday's meals, all bench sessions, recent Push workouts, recipes and activities. Lab requires enough observations before displaying correlations and shows sample-size/causation limitations. Nexus connects local nutrition, pantry, workout, activity, sleep and progress context without uploading the user's complete fitness history.

### Browser compatibility
Veyra's core app is intended for current **Chrome, Edge, Safari (iPhone/iPad/Mac), and Firefox**. Chrome/Edge generally expose the fullest set of browser APIs. Safari and Firefox use JavaScript/manual fallbacks where native APIs are missing.

- **Chrome / Edge:** recommended for the fullest native barcode, speech, install and notification support where the operating system permits it.
- **Safari:** core Veyra is supported. If native `BarcodeDetector` is unavailable, barcode photos use the pinned ZXing JavaScript decoder with rotation, contrast and inversion retries. iPhone/iPad installation uses Safari → Share → Add to Home Screen.
- **Firefox:** core Veyra and barcode-photo fallback are supported. Browser `SpeechRecognition` is generally unavailable, so typed commands or device keyboard dictation use the same Veyra intent pipeline.
- **Browser-dependent features:** native barcode acceleration, built-in speech recognition, exact PWA install UI, notifications/badging, and camera/microphone permission behavior. Food logging/search, pantry, pantry-only recipes, workouts, progress, Replay, Vault, text Coach, and ordinary image uploads are not locked to one browser.

## Privacy / network boundary

Core profile, meals, workouts, activity, sleep, pantry, recipes, settings and personalization remain in the browser. Online lookup is user-triggered. Depending on the feature, Veyra may send only a product/food/restaurant query, barcode, or public website URL to the public source required for that lookup. A complete private fitness history is not sent to those sources.

The optional `gateway/` Cloudflare Worker is lookup-only. `config.js` ships with a blank gateway URL and blank Spotify Client ID; there are no private credentials in the repository.

## External services and graceful fallback

- **Open Food Facts:** public packaged-food/product lookup.
- **USDA FoodData Central:** secondary public food lookup using its published DEMO_KEY route for zero-setup fallback.
- **Wikidata:** official restaurant-site discovery where a suitable entity exists.
- **Jina Reader:** keyless public-page reader used for public restaurant pages; rate limits and availability are external to Veyra.
- **ZXing Browser:** external barcode-decoder fallback loaded from a pinned CDN URL; native detection/manual typed barcode remains available when it cannot load.
- **Transformers.js / Tesseract:** browser-side vision/OCR dependencies loaded on demand; confirmation/manual fallback remains available.
- **Spotify:** optional browser PKCE path. The site owner must register the deployed redirect URI and place the public Client ID in `config.js`. No client secret belongs in the static site.

## Deploy

1. Put the contents of this folder at the root of the `Veyra` GitHub Pages repository/branch used for deployment.
2. Confirm GitHub Pages serves `https://sribyju.github.io/Veyra/` over HTTPS.
3. Leave `gatewayUrl` blank for the zero-setup public-source path, or deploy `gateway/worker.js` and set the public worker URL for a more controlled lookup route.
4. Optionally configure Spotify's public Client ID and redirect URI.
5. Run a final phone spot-check after deployment for camera permission, microphone permission, install behavior and live third-party network availability.

See `QA_REPORT.md`, `REQUIREMENTS_AUDIT.md`, `COMPETITOR_AUDIT.md` and `PUBLISH_CHECKLIST.md` for the release evidence and remaining environment-dependent spot checks.
