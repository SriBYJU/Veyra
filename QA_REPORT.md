# Veyra 3.4.1 QA Report

**Candidate:** Veyra 3.4.1  
**Audit date:** 2026-08-17  
**Release target:** `https://sribyju.github.io/Veyra/`

## Audited baseline

Veyra 3.4.1 is built directly from the previously packaged Veyra 3.4.0 publish candidate. That 3.4.0 baseline passed **328 / 328** deterministic browser/integration checks across the general app, workouts, Profile/Vault, camera/import, Replay, final features, dynamic food, command/release, edge cases and exercise library, and its exact packaged ZIP passed the corresponding static/package validation.

## 3.4.1 final-change validation

The final patch changes only the age-neutral maintenance-target behavior, local-day key, browser-compatibility messaging, Safari/non-native barcode fallback, release version/disclaimer text and associated documentation. A deterministic source/logic delta suite passes **29 / 29** checks covering:

- no runtime `under 18`, `age < 18` or equivalent feature gate;
- maintenance-oriented starter target calculation returns editable calories/macros for both age 16 and age 25 when the same required inputs are present;
- onboarding copy states that age does not unlock/restrict Veyra features;
- `today()` uses a local calendar date key and nutrition totals remain date-scoped;
- Settings includes Browser Compatibility entries for Chrome/Edge, Safari and Firefox;
- browser-dependent native barcode/voice behavior is clearly separated from browser-independent core features;
- barcode scanning retains native `BarcodeDetector` as an accelerator, then falls through to on-demand ZXing;
- ZXing is pinned to version 0.2.1 with jsDelivr and unpkg retry URLs;
- Safari/non-native decoding retries normal, rotated, thresholded and inverted canvases;
- ZXing is no longer a blocking page-start dependency;
- service-worker release cache is versioned to 3.4.1;
- the visible informational disclaimer references Veyra and its creators.

## Static production audit

Before packaging, the 3.4.1 source is checked for JavaScript syntax, manifest validity, sitemap validity, referenced local assets, service-worker CORE assets, explicit under-18 runtime gates, TODO/FIXME markers, private-key markers and packaging leftovers. The same static/package checks are rerun against the files extracted from the final ZIP.

## Browser/device reality

- **Chrome / Edge:** recommended for the fullest native browser-API support.
- **Safari (iPhone/iPad/Mac):** core Veyra is supported. Safari does not need native `BarcodeDetector`; Veyra loads the JavaScript ZXing fallback on demand. A real camera/image can still fail to decode if the barcode is too blurred, cropped, damaged or the decoder CDN is unreachable, in which case typed UPC/EAN remains available.
- **Firefox:** core Veyra is supported. Barcode images use the JavaScript fallback. Built-in speech recognition may be unavailable, so typed commands/device keyboard dictation remain the fallback.
- Native barcode acceleration, speech recognition, camera/microphone permissions, notifications/badging and exact PWA install UI vary by browser/OS. Core food logging/search, pantry, pantry-only recipes, workouts, progress, Replay, Vault, text Coach and image-file uploads are not intentionally browser-locked.

A static ZIP cannot permanently certify third-party network availability or a physical phone's permissions. Those remain deployment/device conditions rather than fake in-app guarantees.

## Release interpretation

Veyra 3.4.1 is the final code/package candidate for this rebuild. It preserves the fully audited 3.4.0 baseline and adds the requested age-neutral maintenance-target behavior, local-midnight date fix, browser-compatibility guidance and stronger Safari barcode fallback. A verification ZIP was packaged, extracted into a clean directory, and passed **29 / 29** final-change checks plus JavaScript syntax, manifest/sitemap, local-asset/service-worker checks and ZIP integrity. The final handoff ZIP is repackaged from the same validated source with only this QA/checklist bookkeeping updated, then revalidated for integrity/static checks.
