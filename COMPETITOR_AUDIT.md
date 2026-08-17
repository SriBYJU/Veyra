# Veyra 3.4.1 — Competitor Audit

**Reviewed:** 2026-08-17  
**Comparison set from the master checklist:** MyFitnessPal, Hevy, Strong, Cronometer.

## Result

Veyra 3.4.1 now covers the material logging mechanics that were relevant to the product direction rather than copying competitors wholesale:

- fast food logging, saved/repeated meals, serving editing, barcode/label/photo paths and nutrition source confidence;
- live workout logging with previous values, weight/reps, timed/distance work, RPE, rest, supersets, substitutions, notes and routines;
- exercise-level load/volume/e1RM history and milestones;
- broad nutrition/macro tracking plus optional supported micronutrients;
- progress ranges and uncertainty-aware predictive presentation;
- pantry-driven recipe construction;
- local history search and connected nutrition/workout/activity/recovery context.

## Where competitors still have structural advantages

Commercial incumbents can have proprietary/native advantages that a free static PWA should not pretend to reproduce:

- much larger licensed/curated food databases and long-running user-contributed catalogs;
- proprietary meal-recognition training data/models;
- mature native Apple/Android/watch integrations and background health-platform access;
- server-side account sync, community/social networks and commercial infrastructure.

Veyra intentionally does **not** fake those capabilities.

## Veyra differentiation kept after the audit

1. **Local-first ownership:** core personal history can function without a Veyra account or cloud fitness database.
2. **One connected context:** food, workout, activity, sleep/recovery, pantry, Replay, Lab and Nexus share one local state.
3. **Dynamic pantry-only cooking:** recipes are constructed from the user's actual pantry instead of merely ranking a preset library by percentage match.
4. **Open-ended resolver with trust labels:** unfamiliar foods continue through public-source/official-site/estimate/manual fallbacks rather than a finite-catalog dead end.
5. **Transparent uncertainty:** source/confidence, estimation limits, Lab sample size, predictive uncertainty and screenshot/vision confirmation are part of the UI.
6. **No unnecessary social layer:** the master audit found no reason to add feeds/followers merely because competitors have them.

## Competitor-derived decisions

- Keep previous-performance visibility, rest timers, supersets, RPE and flexible routine editing because these materially improve workout usability.
- Keep detailed-but-optional nutrition and confidence/source visibility because they materially improve food logging trust.
- Keep fast repeated logging and saved meals because they reduce daily friction.
- Do not claim commercial food-database parity or proprietary meal-scan parity.
- Do not add community/social features unless a future product requirement demonstrates a clear user benefit.

Official product pages reviewed during the comparison include `strong.app`, `hevyapp.com`, `cronometer.com` and `myfitnesspal.com`.
